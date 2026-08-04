import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const origins = new Set([
  "https://luxe-on-demand-app.vercel.app",
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:3000",
  "https://localhost",
]);
const headers = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && origins.has(origin) ? origin : "https://luxe-on-demand-app.vercel.app",
  "Access-Control-Allow-Headers": "content-type,authorization,apikey,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json",
});
const json = (body: unknown, status: number, origin: string | null) => new Response(JSON.stringify(body), { status, headers: headers(origin) });
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !origins.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  try {
    const body = await req.json();
    const first = clean(body.first_name, 80);
    const last = clean(body.last_name, 80);
    const email = clean(body.email, 254).toLowerCase();
    const phone = clean(body.phone, 40);
    const city = clean(body.city, 100);
    const state = clean(body.state_code || body.state, 2).toUpperCase();
    const years = Number.parseInt(String(body.years_experience), 10);
    const requested = Array.isArray(body.services_requested)
      ? [...new Set(body.services_requested.filter((item: unknown) => typeof item === "string"))].slice(0, 30)
      : [];

    if (
      first.length < 2 || last.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 7 ||
      city.length < 2 || !/^[A-Z]{2}$/.test(state) ||
      !Number.isFinite(years) || years < 0 || years > 80 ||
      !requested.length || body.background_check_consent !== true
    ) return json({ error: "Please complete every required application field." }, 400, origin);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: catalog } = await supabase.from("cs_subcategories").select("name").in("name", requested).eq("is_active", true);
    const valid = [...new Set((catalog || []).map((item: { name: string }) => item.name))];
    if (valid.length !== requested.length) return json({ error: "One or more specialties are unavailable." }, 400, origin);

    const { data: recent } = await supabase.from("luxe_provider_applications").select("id").eq("email", email)
      .gte("created_at", new Date(Date.now() - 3_600_000).toISOString()).limit(1);
    if (recent?.length) return json({ error: "An application for this email was recently submitted." }, 429, origin);

    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip))))
      .map(value => value.toString(16).padStart(2, "0")).join("");

    const { data, error } = await supabase.from("luxe_provider_applications").insert({
      first_name:first,last_name:last,email,phone,city,state_code:state,zip_code:clean(body.zip_code,12)||null,
      services_requested:valid,years_experience:years,experience_description:clean(body.experience_description,2000)||null,
      has_vehicle:Boolean(body.has_vehicle),vehicle_type:clean(body.vehicle_type,80)||null,
      background_check_consent:true,portfolio_url:clean(body.portfolio_url,500)||null,source_ip_hash:hash,status:"pending",
    }).select("id,application_number").single();
    if (error) throw error;
    return json({ success:true,application_number:data.application_number }, 201, origin);
  } catch (error) {
    console.error("LUXE provider application failed", error);
    return json({ error:"Application could not be submitted." }, 500, origin);
  }
});
