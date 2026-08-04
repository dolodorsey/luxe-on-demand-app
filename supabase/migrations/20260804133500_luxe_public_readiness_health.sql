-- LUXE ON DEMAND public readiness snapshot.
-- Exposes aggregate launch health only; no provider or recruiting records are returned.

create or replace function public.luxe_get_public_readiness_snapshot()
returns jsonb
language sql
stable
security definer
set search_path='pg_catalog','public'
as $function$
with catalog as (
  select
    count(*) filter (where is_active)::integer as active_categories
  from public.cs_categories
), services as (
  select
    count(*) filter (where is_active)::integer as active_services,
    count(*) filter (where is_active and regulated)::integer as regulated_services,
    count(*) filter (where is_active and mobile_available)::integer as mobile_services,
    count(*) filter (where is_active and in_studio_available)::integer as studio_services
  from public.cs_subcategories
), stylists as (
  select
    count(*)::integer as stylist_profiles,
    count(*) filter (
      where coalesce(license_verified,false)
        and coalesce(id_verified,false)
        and coalesce(bg_check_passed,false)
        and coalesce(insurance_verified,false)
        and nullif(trim(stripe_account_id),'') is not null
        and coalesce(stripe_onboarding_complete,false)
        and coalesce(stripe_details_submitted,false)
        and coalesce(stripe_charges_enabled,false)
        and coalesce(stripe_payouts_enabled,false)
    )::integer as payout_ready_stylists,
    count(*) filter (where coalesce(on_duty,false))::integer as on_duty_stylists
  from public.cs_stylists
), dispatch as (
  select
    count(*)::integer as tracked_services,
    count(*) filter (where approved_payout_ready_stylists>0)::integer as supply_ready_services,
    count(*) filter (where on_duty_dispatch_ready_stylists>0)::integer as live_dispatch_ready_services
  from public.luxe_service_dispatch_readiness
), operations as (
  select
    count(*)::integer as bookings,
    count(*) filter (
      where status in ('requested','matching','accepted','en_route','arrived','in_progress')
    )::integer as active_bookings
  from public.cs_bookings
), payments as (
  select count(*)::integer as payments
  from public.cs_booking_payments
), pipeline as (
  select
    count(*)::integer as supply_candidates,
    count(*) filter (
      where pipeline_stage='qualified' and outreach_status='queued'
    )::integer as first_wave_queued,
    count(*) filter (where pipeline_stage='activated')::integer as activated_candidates
  from public.luxe_supply_candidates
), snapshot as (
  select
    c.active_categories,
    s.active_services,
    s.regulated_services,
    s.mobile_services,
    s.studio_services,
    st.stylist_profiles,
    st.payout_ready_stylists,
    st.on_duty_stylists,
    d.tracked_services,
    d.supply_ready_services,
    d.live_dispatch_ready_services,
    o.bookings,
    o.active_bookings,
    p.payments,
    q.supply_candidates,
    q.first_wave_queued,
    q.activated_candidates
  from catalog c
  cross join services s
  cross join stylists st
  cross join dispatch d
  cross join operations o
  cross join payments p
  cross join pipeline q
)
select jsonb_build_object(
  'app','luxe-on-demand',
  'brand','LUXE ON DEMAND',
  'generated_at',now(),
  'backend',jsonb_build_object(
    'reachable',true,
    'schema_scope','cs_* and luxe_*'
  ),
  'catalog',jsonb_build_object(
    'active_categories',active_categories,
    'active_services',active_services,
    'regulated_services',regulated_services,
    'mobile_services',mobile_services,
    'studio_services',studio_services,
    'catalog_ready',active_categories>0 and active_services>0 and tracked_services=active_services
  ),
  'supply',jsonb_build_object(
    'stylist_profiles',stylist_profiles,
    'payout_ready_stylists',payout_ready_stylists,
    'on_duty_stylists',on_duty_stylists,
    'tracked_services',tracked_services,
    'supply_ready_services',supply_ready_services,
    'live_dispatch_ready_services',live_dispatch_ready_services,
    'supply_readiness_pct',case when active_services=0 then 0 else round(100.0*supply_ready_services/active_services,2) end,
    'live_dispatch_readiness_pct',case when active_services=0 then 0 else round(100.0*live_dispatch_ready_services/active_services,2) end
  ),
  'recruiting',jsonb_build_object(
    'supply_candidates',supply_candidates,
    'first_wave_queued',first_wave_queued,
    'activated_candidates',activated_candidates
  ),
  'operations',jsonb_build_object(
    'bookings',bookings,
    'active_bookings',active_bookings,
    'payments',payments
  ),
  'launch',jsonb_build_object(
    'catalog_ready',active_categories>0 and active_services>0 and tracked_services=active_services,
    'provider_network_ready',supply_ready_services=active_services and active_services>0,
    'live_dispatch_ready',live_dispatch_ready_services=active_services and active_services>0,
    'launch_ready',supply_ready_services=active_services and live_dispatch_ready_services=active_services and active_services>0,
    'blocking_reason',case
      when active_services=0 then 'catalog_empty'
      when tracked_services<>active_services then 'readiness_matrix_incomplete'
      when payout_ready_stylists=0 then 'no_payout_ready_providers'
      when supply_ready_services<active_services then 'service_supply_incomplete'
      when live_dispatch_ready_services<active_services then 'live_provider_coverage_incomplete'
      else null
    end
  )
)
from snapshot;
$function$;

revoke all on function public.luxe_get_public_readiness_snapshot() from public;
grant execute on function public.luxe_get_public_readiness_snapshot() to anon,authenticated,service_role;

comment on function public.luxe_get_public_readiness_snapshot() is
  'Bounded aggregate readiness snapshot for LUXE ON DEMAND health monitoring. Returns no provider or recruiting records.';
