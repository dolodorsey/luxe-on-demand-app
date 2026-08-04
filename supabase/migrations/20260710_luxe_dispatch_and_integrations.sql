-- LUXE On Demand dispatch and integration foundation
-- Generated 2026-07-10. Apply after 20260710_luxe_rls_security.sql.

begin;

-- Creates the LUXE-specific profile only for the currently authenticated user.
-- This avoids attaching a LUXE profile to every account in the shared MCP project.
create or replace function public.cs_upsert_current_user_profile(
  p_first_name text default null,
  p_last_name text default null,
  p_role text default 'client',
  p_gender text default null
)
returns public.cs_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user auth.users%rowtype;
  v_profile public.cs_users%rowtype;
  v_role text := lower(coalesce(nullif(trim(p_role), ''), 'client'));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_role not in ('client','stylist') then
    raise exception 'Invalid LUXE role';
  end if;

  select * into v_auth_user from auth.users where id = auth.uid();
  if not found then
    raise exception 'Auth user not found' using errcode = 'P0002';
  end if;

  insert into public.cs_users (
    auth_id, role, first_name, last_name, email, gender, status, updated_at
  )
  values (
    auth.uid(),
    v_role,
    nullif(trim(p_first_name), ''),
    nullif(trim(p_last_name), ''),
    v_auth_user.email,
    nullif(trim(p_gender), ''),
    'active',
    now()
  )
  on conflict (auth_id) do update
  set first_name = coalesce(excluded.first_name, public.cs_users.first_name),
      last_name = coalesce(excluded.last_name, public.cs_users.last_name),
      gender = coalesce(excluded.gender, public.cs_users.gender),
      email = coalesce(excluded.email, public.cs_users.email),
      updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

create unique index if not exists cs_users_auth_id_uidx
  on public.cs_users(auth_id)
  where auth_id is not null;

create or replace function public.cs_enqueue_integration_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_event_type is null or length(trim(p_event_type)) < 3 then
    raise exception 'event_type is required';
  end if;
  if pg_column_size(coalesce(p_payload, '{}'::jsonb)) > 65536 then
    raise exception 'Integration payload exceeds 64 KB';
  end if;

  insert into public.cs_integration_events(
    event_type, aggregate_type, aggregate_id, requested_by, payload
  )
  values (
    trim(p_event_type), nullif(trim(p_aggregate_type), ''), p_aggregate_id,
    public.cs_current_user_id(), coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.cs_update_stylist_location(
  p_lat double precision,
  p_lng double precision,
  p_on_duty boolean default true
)
returns public.cs_stylists
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stylist_id uuid := public.cs_current_stylist_id();
  v_stylist public.cs_stylists%rowtype;
begin
  if auth.uid() is null or v_stylist_id is null then
    raise exception 'Authenticated stylist required' using errcode = '42501';
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates';
  end if;

  update public.cs_stylists
  set current_lat = p_lat,
      current_lng = p_lng,
      last_location_at = now(),
      on_duty = p_on_duty,
      updated_at = now()
  where id = v_stylist_id
  returning * into v_stylist;

  return v_stylist;
end;
$$;

-- Dispatches a booking only to currently eligible providers. Regulated services
-- require an approved intake and fully verified professional credentials.
create or replace function public.cs_dispatch_booking(
  p_booking_id uuid,
  p_radius_miles double precision default 20,
  p_offer_ttl_seconds integer default 60
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.cs_bookings%rowtype;
  v_subcategory public.cs_subcategories%rowtype;
  v_count integer := 0;
begin
  select * into v_booking
  from public.cs_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if auth.role() <> 'service_role'
     and v_booking.client_id <> public.cs_current_user_id() then
    raise exception 'Not authorized for booking' using errcode = '42501';
  end if;

  if v_booking.stylist_id is not null
     or v_booking.status not in ('requested','matching','scheduled') then
    raise exception 'Booking cannot be dispatched from status %', v_booking.status;
  end if;

  select * into v_subcategory
  from public.cs_subcategories
  where id = v_booking.subcategory_id and coalesce(is_active, true);

  if not found then
    raise exception 'Active service not found' using errcode = 'P0002';
  end if;

  if coalesce(v_subcategory.regulated, false) and not exists (
    select 1
    from public.cs_regulated_intake ri
    where ri.client_id = v_booking.client_id
      and ri.service_requested in (v_subcategory.id, v_subcategory.name)
      and ri.status in ('approved','cleared')
      and ri.medical_director_approved is true
      and ri.license_verified is true
      and ri.state_law_compliant is true
      and ri.pre_screening_completed is true
      and ri.waiver_signed is true
  ) then
    raise exception 'Regulated service requires approved compliance intake';
  end if;

  if v_booking.service_mode = 'mobile'
     and (v_booking.service_lat is null or v_booking.service_lng is null) then
    raise exception 'Mobile booking requires service coordinates';
  end if;

  update public.cs_bookings
  set status = 'matching', updated_at = now()
  where id = p_booking_id;

  with candidates as (
    select
      s.id as stylist_id,
      s.rating,
      coalesce(psm.custom_price, v_subcategory.base_price, v_subcategory.min_price, v_booking.estimated_price, 0) as service_price,
      case
        when v_booking.service_mode = 'mobile' then s.current_lat
        else s.studio_lat
      end as provider_lat,
      case
        when v_booking.service_mode = 'mobile' then s.current_lng
        else s.studio_lng
      end as provider_lng
    from public.cs_stylists s
    join public.cs_provider_service_map psm
      on psm.stylist_id = s.id
     and psm.subcategory_id = v_booking.subcategory_id
    where psm.approval_status in ('approved','verified')
      and s.on_duty is true
      and s.id_verified is true
      and s.bg_check_passed is true
      and s.insurance_verified is true
      and (
        not coalesce(v_subcategory.regulated, false)
        or s.license_verified is true
      )
      and (
        v_booking.service_mode = 'mobile'
        and psm.mobile_offered is true
        and s.current_lat is not null
        and s.current_lng is not null
        and s.last_location_at > now() - interval '5 minutes'
        or
        v_booking.service_mode = 'in_studio'
        and s.studio_lat is not null
        and s.studio_lng is not null
      )
  ), scored as (
    select
      c.*,
      case
        when v_booking.service_lat is null or v_booking.service_lng is null then 0::numeric
        else round((3959 * acos(least(1, greatest(-1,
          cos(radians(v_booking.service_lat)) * cos(radians(c.provider_lat)) *
          cos(radians(c.provider_lng) - radians(v_booking.service_lng)) +
          sin(radians(v_booking.service_lat)) * sin(radians(c.provider_lat))
        ))))::numeric, 2)
      end as distance_miles
    from candidates c
  ), eligible as (
    select * from scored
    where v_booking.service_mode <> 'mobile'
       or distance_miles <= greatest(1, least(p_radius_miles, 50))
    order by distance_miles asc, rating desc nulls last
    limit 20
  )
  insert into public.cs_booking_offers(
    booking_id, stylist_id, status, distance_miles, eta_minutes,
    offered_at, responded_at, expires_at
  )
  select
    p_booking_id,
    e.stylist_id,
    'offered',
    e.distance_miles,
    case
      when v_booking.service_mode = 'mobile' then greatest(5, ceil(e.distance_miles * 3)::integer)
      else 0
    end,
    now(),
    null,
    now() + make_interval(secs => greatest(20, least(p_offer_ttl_seconds, 180)))
  from eligible e
  on conflict (booking_id, stylist_id) do update
  set status = 'offered',
      distance_miles = excluded.distance_miles,
      eta_minutes = excluded.eta_minutes,
      offered_at = excluded.offered_at,
      responded_at = null,
      expires_at = excluded.expires_at;

  get diagnostics v_count = row_count;

  insert into public.cs_booking_events(
    booking_id, event_type, actor_id, metadata
  )
  values (
    p_booking_id,
    'dispatch_started',
    case when auth.role() = 'service_role' then null else public.cs_current_user_id() end,
    jsonb_build_object(
      'old_status', v_booking.status,
      'new_status', 'matching',
      'offers_created', v_count,
      'radius_miles', p_radius_miles,
      'regulated', coalesce(v_subcategory.regulated, false)
    )
  );

  insert into public.cs_integration_events(
    event_type, aggregate_type, aggregate_id, requested_by, payload
  )
  values (
    'booking.dispatch.started', 'cs_booking', p_booking_id,
    case when auth.role() = 'service_role' then null else public.cs_current_user_id() end,
    jsonb_build_object('offers_created', v_count, 'service_mode', v_booking.service_mode)
  );

  return v_count;
end;
$$;

-- Locks both offer and booking records before assignment, preventing two
-- stylists from accepting the same appointment.
create or replace function public.cs_accept_booking_offer(p_offer_id uuid)
returns setof public.cs_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.cs_booking_offers%rowtype;
  v_booking public.cs_bookings%rowtype;
  v_stylist_id uuid := public.cs_current_stylist_id();
begin
  if auth.uid() is null or v_stylist_id is null then
    raise exception 'Authenticated stylist required' using errcode = '42501';
  end if;

  select * into v_offer
  from public.cs_booking_offers
  where id = p_offer_id
  for update;

  if not found or v_offer.stylist_id <> v_stylist_id then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  if v_offer.status <> 'offered' then
    raise exception 'Offer is no longer available';
  end if;
  if v_offer.expires_at is not null and v_offer.expires_at <= now() then
    update public.cs_booking_offers
    set status = 'expired', responded_at = now()
    where id = p_offer_id;
    raise exception 'Offer expired';
  end if;

  select * into v_booking
  from public.cs_bookings
  where id = v_offer.booking_id
  for update;

  if v_booking.stylist_id is not null
     or v_booking.status not in ('requested','matching','scheduled') then
    update public.cs_booking_offers
    set status = 'expired', responded_at = now()
    where id = p_offer_id;
    raise exception 'Booking already assigned';
  end if;

  update public.cs_booking_offers
  set status = 'accepted', responded_at = now()
  where id = p_offer_id;

  update public.cs_booking_offers
  set status = 'expired', responded_at = coalesce(responded_at, now())
  where booking_id = v_offer.booking_id
    and id <> p_offer_id
    and status = 'offered';

  update public.cs_bookings
  set stylist_id = v_stylist_id,
      status = 'accepted',
      matched_at = coalesce(matched_at, now()),
      accepted_at = now(),
      eta_minutes = v_offer.eta_minutes,
      updated_at = now()
  where id = v_offer.booking_id;

  update public.cs_regulated_intake
  set provider_matched = v_stylist_id, reviewed_at = coalesce(reviewed_at, now())
  where client_id = v_booking.client_id
    and service_requested in (
      v_booking.subcategory_id,
      coalesce((select name from public.cs_subcategories where id = v_booking.subcategory_id), '')
    )
    and status in ('approved','cleared');

  insert into public.cs_booking_events(booking_id, event_type, actor_id, metadata)
  values (
    v_offer.booking_id,
    'offer_accepted',
    public.cs_current_user_id(),
    jsonb_build_object(
      'old_status', v_booking.status,
      'new_status', 'accepted',
      'offer_id', p_offer_id,
      'stylist_id', v_stylist_id
    )
  );

  insert into public.cs_integration_events(
    event_type, aggregate_type, aggregate_id, requested_by, payload
  )
  values (
    'booking.accepted', 'cs_booking', v_offer.booking_id,
    public.cs_current_user_id(),
    jsonb_build_object('stylist_id', v_stylist_id, 'offer_id', p_offer_id)
  );

  return query select * from public.cs_bookings where id = v_offer.booking_id;
end;
$$;

create or replace function public.cs_decline_booking_offer(
  p_offer_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stylist_id uuid := public.cs_current_stylist_id();
  v_updated integer;
begin
  if auth.uid() is null or v_stylist_id is null then
    raise exception 'Authenticated stylist required' using errcode = '42501';
  end if;

  update public.cs_booking_offers
  set status = 'declined',
      responded_at = now()
  where id = p_offer_id
    and stylist_id = v_stylist_id
    and status = 'offered';

  get diagnostics v_updated = row_count;

  if v_updated = 1 and nullif(trim(p_reason), '') is not null then
    insert into public.cs_booking_events(booking_id, event_type, actor_id, metadata)
    select booking_id, 'offer_declined', public.cs_current_user_id(),
           jsonb_build_object('offer_id', id, 'reason', nullif(trim(p_reason), ''))
    from public.cs_booking_offers where id = p_offer_id;
  end if;

  return v_updated = 1;
end;
$$;

-- Enforces provider-side booking progression. Direct status updates remain
-- unnecessary once the app calls this RPC.
create or replace function public.cs_advance_booking_status(
  p_booking_id uuid,
  p_new_status text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.cs_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.cs_bookings%rowtype;
  v_stylist_id uuid := public.cs_current_stylist_id();
  v_new_status text := lower(trim(p_new_status));
begin
  if auth.uid() is null or v_stylist_id is null then
    raise exception 'Authenticated stylist required' using errcode = '42501';
  end if;

  select * into v_booking
  from public.cs_bookings
  where id = p_booking_id and stylist_id = v_stylist_id
  for update;

  if not found then
    raise exception 'Assigned booking not found' using errcode = 'P0002';
  end if;

  if not (
    (v_booking.status = 'accepted' and v_new_status = 'en_route')
    or (v_booking.status = 'en_route' and v_new_status = 'arrived')
    or (v_booking.status = 'arrived' and v_new_status = 'started')
    or (v_booking.status = 'started' and v_new_status = 'completed')
  ) then
    raise exception 'Invalid booking transition: % -> %', v_booking.status, v_new_status;
  end if;

  update public.cs_bookings
  set status = v_new_status,
      en_route_at = case when v_new_status = 'en_route' then now() else en_route_at end,
      arrived_at = case when v_new_status = 'arrived' then now() else arrived_at end,
      started_at = case when v_new_status = 'started' then now() else started_at end,
      completed_at = case when v_new_status = 'completed' then now() else completed_at end,
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.cs_booking_events(booking_id, event_type, actor_id, metadata)
  values (
    p_booking_id,
    'status_changed',
    public.cs_current_user_id(),
    jsonb_build_object(
      'old_status', case
        when v_new_status = 'en_route' then 'accepted'
        when v_new_status = 'arrived' then 'en_route'
        when v_new_status = 'started' then 'arrived'
        when v_new_status = 'completed' then 'started'
      end,
      'new_status', v_new_status,
      'lat', p_lat,
      'lng', p_lng,
      'metadata', coalesce(p_metadata, '{}'::jsonb)
    )
  );

  insert into public.cs_integration_events(
    event_type, aggregate_type, aggregate_id, requested_by, payload
  )
  values (
    'booking.' || v_new_status, 'cs_booking', p_booking_id,
    public.cs_current_user_id(),
    jsonb_build_object('stylist_id', v_stylist_id, 'status', v_new_status)
  );

  return v_booking;
end;
$$;

create or replace function public.cs_cancel_booking(
  p_booking_id uuid,
  p_reason text
)
returns public.cs_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.cs_bookings%rowtype;
  v_user_id uuid := public.cs_current_user_id();
  v_stylist_id uuid := public.cs_current_stylist_id();
  v_actor text;
begin
  if auth.uid() is null or v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if length(coalesce(trim(p_reason), '')) < 3 then
    raise exception 'Cancellation reason is required';
  end if;

  select * into v_booking
  from public.cs_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.client_id = v_user_id then
    v_actor := 'client';
  elsif v_booking.stylist_id = v_stylist_id then
    v_actor := 'stylist';
  else
    raise exception 'Not authorized for booking' using errcode = '42501';
  end if;

  if v_booking.status in ('completed','canceled') then
    raise exception 'Booking cannot be canceled from status %', v_booking.status;
  end if;

  update public.cs_bookings
  set status = 'canceled',
      canceled_at = now(),
      canceled_by = v_actor,
      cancel_reason = trim(p_reason),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  update public.cs_booking_offers
  set status = 'canceled', responded_at = coalesce(responded_at, now())
  where booking_id = p_booking_id and status = 'offered';

  insert into public.cs_booking_events(booking_id, event_type, actor_id, metadata)
  values (
    p_booking_id, 'booking_canceled', v_user_id,
    jsonb_build_object('actor', v_actor, 'reason', trim(p_reason))
  );

  insert into public.cs_integration_events(
    event_type, aggregate_type, aggregate_id, requested_by, payload
  )
  values (
    'booking.canceled', 'cs_booking', p_booking_id, v_user_id,
    jsonb_build_object('actor', v_actor, 'reason', trim(p_reason))
  );

  return v_booking;
end;
$$;

revoke all on function public.cs_upsert_current_user_profile(text, text, text, text) from public, anon;
revoke all on function public.cs_enqueue_integration_event(text, text, uuid, jsonb) from public, anon;
revoke all on function public.cs_update_stylist_location(double precision, double precision, boolean) from public, anon;
revoke all on function public.cs_dispatch_booking(uuid, double precision, integer) from public, anon;
revoke all on function public.cs_accept_booking_offer(uuid) from public, anon;
revoke all on function public.cs_decline_booking_offer(uuid, text) from public, anon;
revoke all on function public.cs_advance_booking_status(uuid, text, double precision, double precision, jsonb) from public, anon;
revoke all on function public.cs_cancel_booking(uuid, text) from public, anon;

grant execute on function public.cs_upsert_current_user_profile(text, text, text, text) to authenticated;
grant execute on function public.cs_enqueue_integration_event(text, text, uuid, jsonb) to authenticated;
grant execute on function public.cs_update_stylist_location(double precision, double precision, boolean) to authenticated;
grant execute on function public.cs_dispatch_booking(uuid, double precision, integer) to authenticated;
grant execute on function public.cs_accept_booking_offer(uuid) to authenticated;
grant execute on function public.cs_decline_booking_offer(uuid, text) to authenticated;
grant execute on function public.cs_advance_booking_status(uuid, text, double precision, double precision, jsonb) to authenticated;
grant execute on function public.cs_cancel_booking(uuid, text) to authenticated;

commit;
