-- LUXE mobility only: reduce browser roles to the direct table/view access
-- required by the current rider/driver clients. Stateful mutations continue
-- through authenticated LUXE RPCs and trusted Edge Functions.
--
-- This migration intentionally does not modify oc_* or any other Kollective
-- namespace and does not delete or rewrite LUXE data.

-- Remove inherited/destructive table privileges first. PostgreSQL TRUNCATE is
-- not row-level and therefore must never be available to browser roles here.
revoke all privileges on table public.lm_vehicle_classes from anon, authenticated;
revoke all privileges on table public.lm_pricing_config from anon, authenticated;
revoke all privileges on table public.lm_tax_rates from anon, authenticated;
revoke all privileges on table public.lm_profiles from anon, authenticated;
revoke all privileges on table public.lm_drivers from anon, authenticated;
revoke all privileges on table public.lm_rides from anon, authenticated;
revoke all privileges on table public.lm_ride_events from anon, authenticated;
revoke all privileges on table public.lm_payments from anon, authenticated;
revoke all privileges on table public.lm_payment_events from anon, authenticated;
revoke all privileges on table public.lm_ratings from anon, authenticated;
revoke all privileges on table public.lm_driver_applications from anon, authenticated;
revoke all privileges on table public.lm_ride_driver_public from anon, authenticated;

-- Public reference/config reads used by the fare and vehicle-class experience.
-- Existing RLS policies remain authoritative.
grant select on table public.lm_vehicle_classes to anon, authenticated;
grant select on table public.lm_pricing_config to anon, authenticated;
grant select on table public.lm_tax_rates to anon, authenticated;

-- Authenticated participant reads. RLS restricts each user to their own or
-- participating records. Writes stay behind the LUXE RPC/Edge Function layer.
grant select on table public.lm_profiles to authenticated;
grant select on table public.lm_drivers to authenticated;
grant select on table public.lm_rides to authenticated;
grant select on table public.lm_ride_events to authenticated;
grant select on table public.lm_payments to authenticated;
grant select on table public.lm_ratings to authenticated;
grant select on table public.lm_driver_applications to authenticated;

-- Rider-only driver detail view. It is already SECURITY INVOKER and filters by
-- auth.uid(); anonymous access is unnecessary.
grant select on table public.lm_ride_driver_public to authenticated;

-- lm_payment_events deliberately remains service-role/RPC-only because the
-- current client has no direct read path and payment event internals do not
-- belong in a browser grant surface.
