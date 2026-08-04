-- LUXE service-safe dispatch and operational readiness.
-- Prevents verified stylists from viewing or accepting services they are not approved to perform.
-- Keeps LUXE isolated inside the cs_* / luxe_* namespace.

create unique index if not exists cs_provider_service_map_stylist_subcategory_unique
  on public.cs_provider_service_map(stylist_id,subcategory_id)
  where subcategory_id is not null;

create index if not exists cs_provider_service_map_approved_dispatch_idx
  on public.cs_provider_service_map(stylist_id,subcategory_id,mobile_offered)
  where approval_status='approved' and subcategory_id is not null;

create index if not exists cs_stylists_dispatch_ready_idx
  on public.cs_stylists(on_duty,service_mode,last_location_at)
  where license_verified and id_verified and bg_check_passed and insurance_verified
    and stripe_onboarding_complete and stripe_charges_enabled and stripe_payouts_enabled;

create index if not exists cs_bookings_open_service_mode_idx
  on public.cs_bookings(subcategory_id,service_mode,created_at)
  where status='requested' and stylist_id is null;

create or replace function public.cs_available_requests()
returns table(
  id uuid,
  subcategory_id text,
  service_mode text,
  estimated_price numeric,
  scheduled_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path='pg_catalog','public'
as $function$
  with me as (
    select s.*
    from public.cs_stylists s
    join public.cs_users u on u.id=s.user_id
    where u.auth_id=auth.uid()
      and u.role='stylist'
      and u.status='active'
      and s.on_duty
      and coalesce(s.license_verified,false)
      and coalesce(s.id_verified,false)
      and coalesce(s.bg_check_passed,false)
      and coalesce(s.insurance_verified,false)
      and nullif(trim(s.stripe_account_id),'') is not null
      and coalesce(s.stripe_onboarding_complete,false)
      and coalesce(s.stripe_details_submitted,false)
      and coalesce(s.stripe_charges_enabled,false)
      and coalesce(s.stripe_payouts_enabled,false)
    limit 1
  )
  select b.id,b.subcategory_id,b.service_mode,b.estimated_price,b.scheduled_at,b.created_at
  from public.cs_bookings b
  cross join me
  join public.cs_subcategories service on service.id=b.subcategory_id and service.is_active
  where b.status='requested'
    and b.stylist_id is null
    and exists (
      select 1
      from public.cs_provider_service_map map
      where map.stylist_id=me.id
        and map.subcategory_id=b.subcategory_id
        and map.approval_status='approved'
        and (
          (
            b.service_mode='mobile'
            and coalesce(service.mobile_available,false)
            and coalesce(map.mobile_offered,false)
            and me.service_mode in ('mobile','both')
            and me.current_lat is not null
            and me.current_lng is not null
            and me.last_location_at>=now()-interval '10 minutes'
          )
          or
          (
            b.service_mode='in_studio'
            and coalesce(service.in_studio_available,false)
            and me.service_mode in ('in_studio','both')
            and coalesce(length(trim(me.studio_address)),0)>=5
          )
        )
    )
  order by coalesce(b.scheduled_at,b.created_at),b.created_at
  limit 20;
$function$;

create or replace function public.cs_accept_request(p_booking_id uuid)
returns public.cs_bookings
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_stylist public.cs_stylists%rowtype;
  v_booking public.cs_bookings%rowtype;
begin
  select s.* into v_stylist
  from public.cs_stylists s
  join public.cs_users u on u.id=s.user_id
  where u.auth_id=auth.uid()
    and u.role='stylist'
    and u.status='active'
    and s.on_duty
    and coalesce(s.license_verified,false)
    and coalesce(s.id_verified,false)
    and coalesce(s.bg_check_passed,false)
    and coalesce(s.insurance_verified,false)
    and nullif(trim(s.stripe_account_id),'') is not null
    and coalesce(s.stripe_onboarding_complete,false)
    and coalesce(s.stripe_details_submitted,false)
    and coalesce(s.stripe_charges_enabled,false)
    and coalesce(s.stripe_payouts_enabled,false)
  limit 1;

  if not found then
    raise exception 'Verified, payout-ready, on-duty stylist required';
  end if;

  update public.cs_bookings b
  set stylist_id=v_stylist.id,
      status='accepted',
      accepted_at=now(),
      matched_at=now(),
      updated_at=now()
  where b.id=p_booking_id
    and b.status='requested'
    and b.stylist_id is null
    and exists (
      select 1
      from public.cs_provider_service_map map
      join public.cs_subcategories service
        on service.id=map.subcategory_id and service.is_active
      where map.stylist_id=v_stylist.id
        and map.subcategory_id=b.subcategory_id
        and map.approval_status='approved'
        and (
          (
            b.service_mode='mobile'
            and coalesce(service.mobile_available,false)
            and coalesce(map.mobile_offered,false)
            and v_stylist.service_mode in ('mobile','both')
            and v_stylist.current_lat is not null
            and v_stylist.current_lng is not null
            and v_stylist.last_location_at>=now()-interval '10 minutes'
          )
          or
          (
            b.service_mode='in_studio'
            and coalesce(service.in_studio_available,false)
            and v_stylist.service_mode in ('in_studio','both')
            and coalesce(length(trim(v_stylist.studio_address)),0)>=5
          )
        )
    )
  returning b.* into v_booking;

  if not found then
    raise exception 'Request unavailable or stylist not approved for this service and mode';
  end if;

  return v_booking;
end;
$function$;

create or replace function public.cs_set_on_duty(
  p_on_duty boolean,
  p_lat double precision default null,
  p_lng double precision default null
)
returns public.cs_stylists
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_stylist public.cs_stylists%rowtype;
  v_mobile_ready boolean:=false;
  v_studio_ready boolean:=false;
begin
  select s.* into v_stylist
  from public.cs_stylists s
  join public.cs_users u on u.id=s.user_id
  where u.auth_id=auth.uid()
    and u.role='stylist'
    and u.status='active'
  for update;

  if not found then
    raise exception 'Active stylist account required';
  end if;

  if p_on_duty then
    if not (
      coalesce(v_stylist.license_verified,false)
      and coalesce(v_stylist.id_verified,false)
      and coalesce(v_stylist.bg_check_passed,false)
      and coalesce(v_stylist.insurance_verified,false)
      and nullif(trim(v_stylist.stripe_account_id),'') is not null
      and coalesce(v_stylist.stripe_onboarding_complete,false)
      and coalesce(v_stylist.stripe_details_submitted,false)
      and coalesce(v_stylist.stripe_charges_enabled,false)
      and coalesce(v_stylist.stripe_payouts_enabled,false)
    ) then
      raise exception 'Verification and payout onboarding must be complete before going on duty';
    end if;

    select exists(
      select 1
      from public.cs_provider_service_map map
      join public.cs_subcategories service on service.id=map.subcategory_id and service.is_active
      where map.stylist_id=v_stylist.id
        and map.approval_status='approved'
        and coalesce(map.mobile_offered,false)
        and coalesce(service.mobile_available,false)
        and v_stylist.service_mode in ('mobile','both')
        and p_lat is not null and p_lng is not null
    ) into v_mobile_ready;

    select exists(
      select 1
      from public.cs_provider_service_map map
      join public.cs_subcategories service on service.id=map.subcategory_id and service.is_active
      where map.stylist_id=v_stylist.id
        and map.approval_status='approved'
        and coalesce(service.in_studio_available,false)
        and v_stylist.service_mode in ('in_studio','both')
        and coalesce(length(trim(v_stylist.studio_address)),0)>=5
    ) into v_studio_ready;

    if not v_mobile_ready and not v_studio_ready then
      raise exception 'At least one approved, mode-ready service is required before going on duty';
    end if;
  end if;

  update public.cs_stylists
  set on_duty=p_on_duty,
      current_lat=case when not p_on_duty then null when p_lat is not null then p_lat else current_lat end,
      current_lng=case when not p_on_duty then null when p_lng is not null then p_lng else current_lng end,
      last_location_at=case when p_on_duty and p_lat is not null and p_lng is not null then now() else last_location_at end,
      updated_at=now()
  where id=v_stylist.id
  returning * into v_stylist;

  return v_stylist;
end;
$function$;

create or replace function public.cs_stylist_transition(
  p_booking_id uuid,
  p_status text
)
returns public.cs_bookings
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_sid uuid;
  v_current text;
  v_booking public.cs_bookings%rowtype;
  v_payment_status text;
begin
  select s.id into v_sid
  from public.cs_stylists s
  join public.cs_users u on u.id=s.user_id
  where u.auth_id=auth.uid()
    and u.role='stylist'
    and u.status='active'
    and coalesce(s.license_verified,false)
    and coalesce(s.id_verified,false)
    and coalesce(s.bg_check_passed,false)
    and coalesce(s.insurance_verified,false)
    and nullif(trim(s.stripe_account_id),'') is not null
    and coalesce(s.stripe_onboarding_complete,false)
    and coalesce(s.stripe_details_submitted,false)
    and coalesce(s.stripe_charges_enabled,false)
    and coalesce(s.stripe_payouts_enabled,false);

  if v_sid is null then
    raise exception 'Verified and payout-ready stylist profile required';
  end if;

  select status into v_current
  from public.cs_bookings
  where id=p_booking_id and stylist_id=v_sid
  for update;

  if not found then
    raise exception 'Assigned booking not found';
  end if;

  if not (
    (v_current='accepted' and p_status='en_route') or
    (v_current='en_route' and p_status='arrived') or
    (v_current='arrived' and p_status='in_progress') or
    (v_current='in_progress' and p_status='completed')
  ) then
    raise exception 'Invalid booking transition';
  end if;

  if p_status='en_route' then
    select status into v_payment_status
    from public.cs_booking_payments
    where booking_id=p_booking_id;

    if v_payment_status is distinct from 'authorized' then
      raise exception 'Customer payment authorization required before travel';
    end if;
  end if;

  update public.cs_bookings
  set status=p_status,
      en_route_at=case when p_status='en_route' then now() else en_route_at end,
      arrived_at=case when p_status='arrived' then now() else arrived_at end,
      started_at=case when p_status='in_progress' then now() else started_at end,
      completed_at=case when p_status='completed' then now() else completed_at end,
      final_price=case when p_status='completed' then estimated_price else final_price end,
      updated_at=now()
  where id=p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$function$;

create or replace view public.luxe_service_dispatch_readiness
with (security_invoker=true)
as
select
  service.category_id,
  service.id as service_id,
  service.name as service_name,
  service.mobile_available,
  service.in_studio_available,
  count(distinct map.stylist_id) filter (
    where map.approval_status='approved'
      and user_profile.status='active'
      and user_profile.role='stylist'
      and coalesce(stylist.license_verified,false)
      and coalesce(stylist.id_verified,false)
      and coalesce(stylist.bg_check_passed,false)
      and coalesce(stylist.insurance_verified,false)
      and nullif(trim(stylist.stripe_account_id),'') is not null
      and coalesce(stylist.stripe_onboarding_complete,false)
      and coalesce(stylist.stripe_details_submitted,false)
      and coalesce(stylist.stripe_charges_enabled,false)
      and coalesce(stylist.stripe_payouts_enabled,false)
  )::integer as approved_payout_ready_stylists,
  count(distinct map.stylist_id) filter (
    where map.approval_status='approved'
      and user_profile.status='active'
      and user_profile.role='stylist'
      and stylist.on_duty
      and coalesce(stylist.license_verified,false)
      and coalesce(stylist.id_verified,false)
      and coalesce(stylist.bg_check_passed,false)
      and coalesce(stylist.insurance_verified,false)
      and nullif(trim(stylist.stripe_account_id),'') is not null
      and coalesce(stylist.stripe_onboarding_complete,false)
      and coalesce(stylist.stripe_details_submitted,false)
      and coalesce(stylist.stripe_charges_enabled,false)
      and coalesce(stylist.stripe_payouts_enabled,false)
      and (
        (
          service.mobile_available
          and map.mobile_offered
          and stylist.service_mode in ('mobile','both')
          and stylist.current_lat is not null
          and stylist.current_lng is not null
          and stylist.last_location_at>=now()-interval '10 minutes'
        )
        or
        (
          service.in_studio_available
          and stylist.service_mode in ('in_studio','both')
          and coalesce(length(trim(stylist.studio_address)),0)>=5
        )
      )
  )::integer as on_duty_dispatch_ready_stylists
from public.cs_subcategories service
left join public.cs_provider_service_map map on map.subcategory_id=service.id
left join public.cs_stylists stylist on stylist.id=map.stylist_id
left join public.cs_users user_profile on user_profile.id=stylist.user_id
where service.is_active
group by service.category_id,service.id,service.name,service.mobile_available,service.in_studio_available;

revoke all on public.luxe_service_dispatch_readiness from public,anon,authenticated;
grant select on public.luxe_service_dispatch_readiness to service_role;

revoke all on function public.cs_available_requests() from public,anon;
revoke all on function public.cs_accept_request(uuid) from public,anon;
revoke all on function public.cs_set_on_duty(boolean,double precision,double precision) from public,anon;
revoke all on function public.cs_stylist_transition(uuid,text) from public,anon;
grant execute on function public.cs_available_requests() to authenticated,service_role;
grant execute on function public.cs_accept_request(uuid) to authenticated,service_role;
grant execute on function public.cs_set_on_duty(boolean,double precision,double precision) to authenticated,service_role;
grant execute on function public.cs_stylist_transition(uuid,text) to authenticated,service_role;
