-- LUXE public aggregate driver-supply contract.
-- Exposes only class-level counts. No driver identity, location, payout account,
-- contact information, or application data is returned.

begin;

create or replace function public.lm_public_driver_supply()
returns table (
  vehicle_class_id text,
  vehicle_class_name text,
  approved_driver_count bigint,
  payout_ready_driver_count bigint,
  on_duty_driver_count bigint,
  has_requestable_supply boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    vc.id,
    vc.name,
    count(d.id) filter (where d.approval_status='approved')::bigint as approved_driver_count,
    count(d.id) filter (where d.approval_status='approved' and d.payouts_enabled)::bigint as payout_ready_driver_count,
    count(d.id) filter (where d.approval_status='approved' and d.payouts_enabled and d.on_duty)::bigint as on_duty_driver_count,
    (count(d.id) filter (where d.approval_status='approved' and d.payouts_enabled and d.on_duty) > 0) as has_requestable_supply
  from public.lm_vehicle_classes vc
  left join public.lm_drivers d on d.vehicle_class_id=vc.id
  where vc.is_active=true
  group by vc.id,vc.name,vc.sort_order
  order by vc.sort_order,vc.name;
$$;

revoke all on function public.lm_public_driver_supply() from public;
grant execute on function public.lm_public_driver_supply() to anon, authenticated, service_role;

commit;
