-- Production repair discovered during authenticated lifecycle QA.
--
-- The previous function referenced cs_stylists.verification_status, a column
-- that does not exist. Use the same concrete verification controls already
-- enforced by cs_set_on_duty and cs_accept_request.

create or replace function public.cs_stylist_transition(
  p_booking_id uuid,
  p_status text
)
returns public.cs_bookings
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_sid uuid;
  v_current text;
  v public.cs_bookings%rowtype;
  v_payment_status text;
begin
  select s.id
    into v_sid
  from public.cs_stylists s
  join public.cs_users u on u.id = s.user_id
  where u.auth_id = auth.uid()
    and u.role = 'stylist'
    and u.status = 'active'
    and coalesce(s.license_verified, false)
    and coalesce(s.id_verified, false)
    and coalesce(s.bg_check_passed, false)
    and coalesce(s.insurance_verified, false);

  if v_sid is null then
    raise exception 'Verified stylist profile required';
  end if;

  select status
    into v_current
  from public.cs_bookings
  where id = p_booking_id
    and stylist_id = v_sid
  for update;

  if not found then
    raise exception 'Assigned booking not found';
  end if;

  if not (
    (v_current = 'accepted' and p_status = 'en_route') or
    (v_current = 'en_route' and p_status = 'arrived') or
    (v_current = 'arrived' and p_status = 'in_progress') or
    (v_current = 'in_progress' and p_status = 'completed')
  ) then
    raise exception 'Invalid booking transition';
  end if;

  if p_status = 'en_route' then
    select status
      into v_payment_status
    from public.cs_booking_payments
    where booking_id = p_booking_id;

    if v_payment_status is distinct from 'authorized' then
      raise exception 'Customer payment authorization required before travel';
    end if;
  end if;

  update public.cs_bookings
  set status = p_status,
      en_route_at = case when p_status = 'en_route' then now() else en_route_at end,
      arrived_at = case when p_status = 'arrived' then now() else arrived_at end,
      started_at = case when p_status = 'in_progress' then now() else started_at end,
      completed_at = case when p_status = 'completed' then now() else completed_at end,
      final_price = case when p_status = 'completed' then estimated_price else final_price end,
      updated_at = now()
  where id = p_booking_id
  returning * into v;

  return v;
end;
$function$;

revoke all on function public.cs_stylist_transition(uuid, text) from public;
grant execute on function public.cs_stylist_transition(uuid, text) to authenticated, service_role;
