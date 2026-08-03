import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.0";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": Deno.env.get("LUXE_APP_ORIGIN") || "https://luxe-on-demand-app.vercel.app", "access-control-allow-headers": "authorization, content-type, apikey" } });
const stripe = async (path: string, body?: URLSearchParams, method = "POST") => {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("PAYMENTS_NOT_CONFIGURED");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: { authorization: `Bearer ${key}`, ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}) }, body });
  const value = await response.json();
  if (!response.ok) throw new Error(value?.error?.message || "Stripe request failed");
  return value;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  try {
    if (!Deno.env.get("STRIPE_SECRET_KEY")) return json({ error: "Payments are temporarily unavailable while secure credentials are rotated." }, 503);
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Invalid session" }, 401);
    const { action, booking_id } = await req.json();
    if (!booking_id || !["authorize", "capture", "cancel", "connect_onboarding"].includes(action)) return json({ error: "Invalid payment request" }, 400);
    const { data: profile } = await admin.from("cs_users").select("id,stripe_customer_id").eq("auth_id", auth.user.id).single();
    if (!profile) return json({ error: "LUXE profile required" }, 403);

    if (action === "connect_onboarding") {
      const { data: stylist } = await admin.from("cs_stylists").select("id,stripe_account_id,verification_status").eq("user_id", profile.id).single();
      if (!stylist || stylist.verification_status !== "verified") return json({ error: "Verified stylist profile required" }, 403);
      let accountId = stylist.stripe_account_id;
      if (!accountId) {
        const params = new URLSearchParams({ type: "express", country: "US", "capabilities[transfers][requested]": "true", "metadata[luxe_stylist_id]": stylist.id });
        const account = await stripe("accounts", params); accountId = account.id;
        await admin.from("cs_stylists").update({ stripe_account_id: accountId }).eq("id", stylist.id);
      }
      const origin = Deno.env.get("LUXE_APP_ORIGIN") || "https://luxe-on-demand-app.vercel.app";
      const link = await stripe("account_links", new URLSearchParams({ account: accountId, refresh_url: `${origin}?connect=refresh`, return_url: `${origin}?connect=complete`, type: "account_onboarding" }));
      return json({ url: link.url });
    }

    const { data: booking } = await admin.from("cs_bookings").select("id,client_id,stylist_id,status,estimated_price,final_price").eq("id", booking_id).single();
    if (!booking) return json({ error: "Booking not found" }, 404);
    const { data: stylist } = await admin.from("cs_stylists").select("id,user_id,stripe_account_id,stripe_payouts_enabled,verification_status").eq("id", booking.stylist_id).single();
    const isClient = booking.client_id === profile.id;
    const isStylist = stylist?.user_id === profile.id;
    if (!isClient && !isStylist) return json({ error: "Not permitted" }, 403);

    if (action === "authorize") {
      if (!isClient || booking.status !== "accepted" || !stylist) return json({ error: "An accepted, assigned booking is required" }, 409);
      const amount = Math.round(Number(booking.final_price || booking.estimated_price) * 100);
      if (!Number.isInteger(amount) || amount < 50) return json({ error: "A valid confirmed price is required" }, 409);
      const fee = Math.round(amount * 0.2); const payout = amount - fee;
      let customerId = profile.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe("customers", new URLSearchParams({ email: auth.user.email || "", "metadata[luxe_user_id]": profile.id })); customerId = customer.id;
        await admin.from("cs_users").update({ stripe_customer_id: customerId }).eq("id", profile.id);
      }
      const existing = await admin.from("cs_booking_payments").select("stripe_payment_intent_id,status").eq("booking_id", booking.id).maybeSingle();
      if (existing.data?.stripe_payment_intent_id && ["requires_payment_method","requires_action","authorized"].includes(existing.data.status)) {
        const intent = await stripe(`payment_intents/${existing.data.stripe_payment_intent_id}`, undefined, "GET");
        return json({ client_secret: intent.client_secret, status: existing.data.status });
      }
      const params = new URLSearchParams({ amount: String(amount), currency: "usd", customer: customerId, capture_method: "manual", "automatic_payment_methods[enabled]": "true", transfer_group: `luxe_booking_${booking.id}`, "metadata[luxe_booking_id]": booking.id, "metadata[luxe_stylist_id]": stylist.id });
      const intent = await stripe("payment_intents", params);
      await admin.from("cs_booking_payments").upsert({ booking_id: booking.id, client_id: booking.client_id, stylist_id: stylist.id, status: "requires_payment_method", amount_cents: amount, platform_fee_cents: fee, stylist_payout_cents: payout, stripe_payment_intent_id: intent.id, updated_at: new Date().toISOString() }, { onConflict: "booking_id" });
      return json({ client_secret: intent.client_secret, status: "requires_payment_method" });
    }

    const { data: payment } = await admin.from("cs_booking_payments").select("*").eq("booking_id", booking.id).single();
    if (!payment) return json({ error: "Booking payment not found" }, 404);
    if (action === "capture") {
      if (!isStylist || booking.status !== "completed" || payment.status !== "authorized") return json({ error: "Completed, authorized booking required" }, 409);
      const intent = await stripe(`payment_intents/${payment.stripe_payment_intent_id}/capture`, new URLSearchParams());
      return json({ status: intent.status });
    }
    if (action === "cancel") {
      if (!isClient || !["requested","accepted","canceled"].includes(booking.status) || !["requires_payment_method","requires_action","authorized"].includes(payment.status)) return json({ error: "Payment cannot be canceled" }, 409);
      const intent = await stripe(`payment_intents/${payment.stripe_payment_intent_id}/cancel`, new URLSearchParams());
      return json({ status: intent.status });
    }
    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment request failed";
    return json({ error: message === "PAYMENTS_NOT_CONFIGURED" ? "Payments are temporarily unavailable while secure credentials are rotated." : message }, message === "PAYMENTS_NOT_CONFIGURED" ? 503 : 400);
  }
});
