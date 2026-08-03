import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.0";

const encode = new TextEncoder();
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const secureEqual = (a: string, b: string) => a.length === b.length && [...a].reduce((v, c, i) => v | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

Deno.serve(async (req) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret || !stripeKey) return new Response("Stripe credentials not configured", { status: 503 });
  const raw = await req.text(); const signature = req.headers.get("stripe-signature") || "";
  const timestamp = signature.match(/(?:^|,)t=([^,]+)/)?.[1]; const signatures = [...signature.matchAll(/(?:^|,)v1=([^,]+)/g)].map((m) => m[1]);
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return new Response("Invalid signature", { status: 400 });
  const key = await crypto.subtle.importKey("raw", encode.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, encode.encode(`${timestamp}.${raw}`)));
  if (!signatures.some((value) => secureEqual(value, expected))) return new Response("Invalid signature", { status: 400 });
  const event = JSON.parse(raw); const object = event.data?.object || {};
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const inserted = await admin.from("cs_payment_events").insert({ stripe_event_id: event.id, event_type: event.type, payment_intent_id: object.id, payload: event }).select("id").maybeSingle();
  if (inserted.error?.code === "23505") return new Response("ok");
  if (inserted.error) return new Response("Database error", { status: 500 });
  const statusMap: Record<string,string> = { "payment_intent.amount_capturable_updated": "authorized", "payment_intent.succeeded": "captured", "payment_intent.canceled": "canceled", "payment_intent.payment_failed": "failed", "charge.dispute.created": "disputed", "charge.refunded": "refunded" };
  const paymentIntentId = object.object === "payment_intent" ? object.id : object.payment_intent;
  const next = statusMap[event.type];
  if (next && paymentIntentId) {
    const updates: Record<string,unknown> = { status: next, updated_at: new Date().toISOString() };
    if (next === "authorized") updates.authorized_at = new Date().toISOString();
    if (next === "captured") { updates.captured_at = new Date().toISOString(); updates.stripe_charge_id = object.latest_charge || null; }
    if (next === "canceled") updates.canceled_at = new Date().toISOString();
    if (next === "disputed") updates.disputed_at = new Date().toISOString();
    if (next === "failed") updates.failure_message = object.last_payment_error?.message || "Payment failed";
    await admin.from("cs_booking_payments").update(updates).eq("stripe_payment_intent_id", paymentIntentId);
  }
  if (event.type === "payment_intent.succeeded" && paymentIntentId) {
    const { data: payment } = await admin.from("cs_booking_payments").select("id,booking_id,stylist_id,stylist_payout_cents,stripe_transfer_id").eq("stripe_payment_intent_id", paymentIntentId).single();
    const { data: booking } = payment ? await admin.from("cs_bookings").select("status").eq("id", payment.booking_id).single() : { data: null };
    const { data: stylist } = payment ? await admin.from("cs_stylists").select("stripe_account_id,stripe_payouts_enabled").eq("id", payment.stylist_id).single() : { data: null };
    if (payment && !payment.stripe_transfer_id && booking?.status === "completed" && stylist?.stripe_account_id && stylist.stripe_payouts_enabled) {
      const transferBody = new URLSearchParams({ amount: String(payment.stylist_payout_cents), currency: "usd", destination: stylist.stripe_account_id, transfer_group: `luxe_booking_${payment.booking_id}`, "metadata[luxe_booking_id]": payment.booking_id });
      const transferResponse = await fetch("https://api.stripe.com/v1/transfers", { method: "POST", headers: { authorization: `Bearer ${stripeKey}`, "content-type": "application/x-www-form-urlencoded", "Idempotency-Key": `luxe_release_${payment.booking_id}` }, body: transferBody });
      const transfer = await transferResponse.json();
      if (transferResponse.ok) await admin.from("cs_booking_payments").update({ status: "released", stripe_transfer_id: transfer.id, released_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", payment.id);
    }
  }
  if (event.type === "account.updated") await admin.from("cs_stylists").update({ stripe_charges_enabled: !!object.charges_enabled, stripe_payouts_enabled: !!object.payouts_enabled, stripe_details_submitted: !!object.details_submitted, stripe_onboarding_complete: !!object.details_submitted && !!object.payouts_enabled }).eq("stripe_account_id", object.id);
  return new Response("ok");
});
