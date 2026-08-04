-- LUXE On Demand row-level security foundation
-- Generated 2026-07-10. Apply in a Supabase development branch first.
-- This migration secures the existing cs_* schema without mixing LUXE with
-- other MCP Gateway products. A dedicated LUXE Supabase project remains the
-- target production architecture.

begin;

create extension if not exists pgcrypto;

create or replace function public.cs_current_user_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select id from public.cs_users where auth_id = auth.uid() limit 1
$$;

create or replace function public.cs_current_stylist_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select s.id
  from public.cs_stylists s
  join public.cs_users u on u.id = s.user_id
  where u.auth_id = auth.uid()
  limit 1
$$;

revoke all on function public.cs_current_user_id() from public, anon;
revoke all on function public.cs_current_stylist_id() from public, anon;
grant execute on function public.cs_current_user_id() to authenticated;
grant execute on function public.cs_current_stylist_id() to authenticated;

create table if not exists public.cs_integration_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text,
  aggregate_id uuid,
  requested_by uuid references public.cs_users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','processing','delivered','failed','dead_letter')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cs_integration_events_delivery_idx
  on public.cs_integration_events(status, next_attempt_at);
create index if not exists cs_booking_offers_stylist_status_idx
  on public.cs_booking_offers(stylist_id, status, expires_at);
create unique index if not exists cs_booking_offers_booking_stylist_uidx
  on public.cs_booking_offers(booking_id, stylist_id);
create index if not exists cs_booking_events_booking_created_idx
  on public.cs_booking_events(booking_id, created_at);
create index if not exists cs_bookings_status_created_idx
  on public.cs_bookings(status, created_at desc);
create index if not exists cs_stylists_dispatch_idx
  on public.cs_stylists(on_duty, last_location_at, license_verified, bg_check_passed);

-- Enable RLS on every LUXE table, including future cs_* tables already present
-- when this migration is executed.
do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public' and tablename like 'cs\_%' escape '\'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Public service catalog. Only active, non-user data is exposed.
-- ---------------------------------------------------------------------------
drop policy if exists "Public read active LUXE categories" on public.cs_categories;
create policy "Public read active LUXE categories"
on public.cs_categories for select
to anon, authenticated
using (coalesce(is_active, true));

drop policy if exists "Public read active LUXE subcategories" on public.cs_subcategories;
create policy "Public read active LUXE subcategories"
on public.cs_subcategories for select
to anon, authenticated
using (coalesce(is_active, true));

drop policy if exists "Public read active LUXE service addons" on public.cs_service_addons;
create policy "Public read active LUXE service addons"
on public.cs_service_addons for select
to anon, authenticated
using (coalesce(is_active, true));

drop policy if exists "Authenticated read active LUXE pricing rules" on public.cs_pricing_rules;
create policy "Authenticated read active LUXE pricing rules"
on public.cs_pricing_rules for select
to authenticated
using (coalesce(active, true) and (start_at is null or start_at <= now()) and (end_at is null or end_at > now()));

-- ---------------------------------------------------------------------------
-- Account and provider ownership.
-- ---------------------------------------------------------------------------
drop policy if exists "Users create own LUXE profile" on public.cs_users;
create policy "Users create own LUXE profile"
on public.cs_users for insert
to authenticated
with check (auth_id = auth.uid());

drop policy if exists "Users read own LUXE profile" on public.cs_users;
create policy "Users read own LUXE profile"
on public.cs_users for select
to authenticated
using (auth_id = auth.uid());

drop policy if exists "Users update own LUXE profile" on public.cs_users;
create policy "Users update own LUXE profile"
on public.cs_users for update
to authenticated
using (auth_id = auth.uid())
with check (auth_id = auth.uid());

drop policy if exists "Stylists create own LUXE profile" on public.cs_stylists;
create policy "Stylists create own LUXE profile"
on public.cs_stylists for insert
to authenticated
with check (user_id = public.cs_current_user_id());

drop policy if exists "Stylists read own LUXE profile" on public.cs_stylists;
create policy "Stylists read own LUXE profile"
on public.cs_stylists for select
to authenticated
using (user_id = public.cs_current_user_id());

drop policy if exists "Stylists update own LUXE profile" on public.cs_stylists;
create policy "Stylists update own LUXE profile"
on public.cs_stylists for update
to authenticated
using (user_id = public.cs_current_user_id())
with check (user_id = public.cs_current_user_id());

-- Safe public stylist discovery is an RPC rather than direct table access, so
-- license numbers, Stripe IDs, internal onboarding and other private columns
-- remain inaccessible.
create or replace function public.cs_browse_stylists(
  p_subcategory_id text default null,
  p_service_mode text default null,
  p_limit integer default 25
)
returns table (
  stylist_id uuid,
  display_name text,
  bio text,
  level text,
  rating numeric,
  total_bookings integer,
  specialties text[],
  service_mode text,
  studio_name text,
  studio_address text,
  portfolio_urls text[],
  instagram_handle text,
  badges text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.display_name,
    s.bio,
    s.level,
    s.rating,
    s.total_bookings,
    s.specialties,
    s.service_mode,
    s.studio_name,
    s.studio_address,
    s.portfolio_urls,
    s.instagram_handle,
    s.badges
  from public.cs_stylists s
  where s.id_verified is true
    and s.bg_check_passed is true
    and (
      p_service_mode is null
      or s.service_mode = p_service_mode
      or s.service_mode = 'both'
    )
    and (
      p_subcategory_id is null
      or exists (
        select 1
        from public.cs_provider_service_map psm
        where psm.stylist_id = s.id
          and psm.subcategory_id = p_subcategory_id
          and psm.approval_status in ('approved','verified')
      )
    )
  order by s.rating desc nulls last, s.total_bookings desc nulls last
  limit greatest(1, least(coalesce(p_limit, 25), 100))
$$;

revoke all on function public.cs_browse_stylists(text, text, integer) from public;
grant execute on function public.cs_browse_stylists(text, text, integer) to anon, authenticated;

-- Provider-owned configuration and portfolio.
drop policy if exists "Stylists manage own LUXE service map" on public.cs_provider_service_map;
create policy "Stylists manage own LUXE service map"
on public.cs_provider_service_map for all
to authenticated
using (stylist_id = public.cs_current_stylist_id())
with check (stylist_id = public.cs_current_stylist_id());

drop policy if exists "Authenticated read approved LUXE service map" on public.cs_provider_service_map;
create policy "Authenticated read approved LUXE service map"
on public.cs_provider_service_map for select
to authenticated
using (approval_status in ('approved','verified'));

drop policy if exists "Stylists manage own LUXE tags" on public.cs_provider_tags;
create policy "Stylists manage own LUXE tags"
on public.cs_provider_tags for all
to authenticated
using (stylist_id = public.cs_current_stylist_id())
with check (stylist_id = public.cs_current_stylist_id());

drop policy if exists "Authenticated read LUXE provider tags" on public.cs_provider_tags;
create policy "Authenticated read LUXE provider tags"
on public.cs_provider_tags for select
to authenticated
using (true);

drop policy if exists "Stylists manage own LUXE availability" on public.cs_stylist_availability;
create policy "Stylists manage own LUXE availability"
on public.cs_stylist_availability for all
to authenticated
using (stylist_id = public.cs_current_stylist_id())
with check (stylist_id = public.cs_current_stylist_id());

drop policy if exists "Authenticated read LUXE availability" on public.cs_stylist_availability;
create policy "Authenticated read LUXE availability"
on public.cs_stylist_availability for select
to authenticated
using (true);

drop policy if exists "Stylists manage own LUXE portfolio" on public.cs_portfolio;
create policy "Stylists manage own LUXE portfolio"
on public.cs_portfolio for all
to authenticated
using (stylist_id = public.cs_current_stylist_id())
with check (stylist_id = public.cs_current_stylist_id());

drop policy if exists "Public read LUXE portfolio" on public.cs_portfolio;
create policy "Public read LUXE portfolio"
on public.cs_portfolio for select
to anon, authenticated
using (true);

drop policy if exists "Stylists read own LUXE earnings" on public.cs_stylist_earnings;
create policy "Stylists read own LUXE earnings"
on public.cs_stylist_earnings for select
to authenticated
using (stylist_id = public.cs_current_stylist_id());

-- ---------------------------------------------------------------------------
-- Booking lifecycle and participant visibility.
-- ---------------------------------------------------------------------------
drop policy if exists "Clients create own LUXE bookings" on public.cs_bookings;
create policy "Clients create own LUXE bookings"
on public.cs_bookings for insert
to authenticated
with check (client_id = public.cs_current_user_id());

drop policy if exists "Clients read own LUXE bookings" on public.cs_bookings;
create policy "Clients read own LUXE bookings"
on public.cs_bookings for select
to authenticated
using (client_id = public.cs_current_user_id());

drop policy if exists "Clients update own unassigned LUXE bookings" on public.cs_bookings;
create policy "Clients update own unassigned LUXE bookings"
on public.cs_bookings for update
to authenticated
using (client_id = public.cs_current_user_id() and status in ('requested','matching','scheduled'))
with check (client_id = public.cs_current_user_id());

drop policy if exists "Stylists read assigned LUXE bookings" on public.cs_bookings;
create policy "Stylists read assigned LUXE bookings"
on public.cs_bookings for select
to authenticated
using (stylist_id = public.cs_current_stylist_id());

drop policy if exists "Stylists update assigned LUXE bookings" on public.cs_bookings;
create policy "Stylists update assigned LUXE bookings"
on public.cs_bookings for update
to authenticated
using (stylist_id = public.cs_current_stylist_id())
with check (stylist_id = public.cs_current_stylist_id());

drop policy if exists "Booking participants read LUXE offers" on public.cs_booking_offers;
create policy "Booking participants read LUXE offers"
on public.cs_booking_offers for select
to authenticated
using (
  stylist_id = public.cs_current_stylist_id()
  or exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id and b.client_id = public.cs_current_user_id()
  )
);

drop policy if exists "Booking participants read LUXE events" on public.cs_booking_events;
create policy "Booking participants read LUXE events"
on public.cs_booking_events for select
to authenticated
using (
  exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id
      and (b.client_id = public.cs_current_user_id() or b.stylist_id = public.cs_current_stylist_id())
  )
);

drop policy if exists "Booking participants read LUXE addons" on public.cs_booking_addons;
create policy "Booking participants read LUXE addons"
on public.cs_booking_addons for select
to authenticated
using (
  exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id
      and (b.client_id = public.cs_current_user_id() or b.stylist_id = public.cs_current_stylist_id())
  )
);

drop policy if exists "Clients add addons to own LUXE booking" on public.cs_booking_addons;
create policy "Clients add addons to own LUXE booking"
on public.cs_booking_addons for insert
to authenticated
with check (
  exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id
      and b.client_id = public.cs_current_user_id()
      and b.status in ('requested','matching','accepted','scheduled')
  )
);

drop policy if exists "Booking participants read LUXE fees" on public.cs_booking_fees;
create policy "Booking participants read LUXE fees"
on public.cs_booking_fees for select
to authenticated
using (
  exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id
      and (b.client_id = public.cs_current_user_id() or b.stylist_id = public.cs_current_stylist_id())
  )
);

-- ---------------------------------------------------------------------------
-- Intake, compliance, proof, payments and trust/safety.
-- ---------------------------------------------------------------------------
drop policy if exists "Clients manage own LUXE intake" on public.cs_customer_intake;
create policy "Clients manage own LUXE intake"
on public.cs_customer_intake for all
to authenticated
using (client_id = public.cs_current_user_id())
with check (client_id = public.cs_current_user_id());

drop policy if exists "Assigned stylists read LUXE client intake" on public.cs_customer_intake;
create policy "Assigned stylists read LUXE client intake"
on public.cs_customer_intake for select
to authenticated
using (
  booking_id is not null
  and exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id and b.stylist_id = public.cs_current_stylist_id()
  )
);

drop policy if exists "Clients create own LUXE regulated intake" on public.cs_regulated_intake;
create policy "Clients create own LUXE regulated intake"
on public.cs_regulated_intake for insert
to authenticated
with check (client_id = public.cs_current_user_id());

drop policy if exists "Clients read own LUXE regulated intake" on public.cs_regulated_intake;
create policy "Clients read own LUXE regulated intake"
on public.cs_regulated_intake for select
to authenticated
using (client_id = public.cs_current_user_id());

drop policy if exists "Matched stylists read approved LUXE regulated intake" on public.cs_regulated_intake;
create policy "Matched stylists read approved LUXE regulated intake"
on public.cs_regulated_intake for select
to authenticated
using (
  provider_matched = public.cs_current_stylist_id()
  and status in ('approved','cleared')
);

drop policy if exists "Booking participants read LUXE proof" on public.cs_proof_of_service;
create policy "Booking participants read LUXE proof"
on public.cs_proof_of_service for select
to authenticated
using (
  exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id
      and (b.client_id = public.cs_current_user_id() or b.stylist_id = public.cs_current_stylist_id())
  )
);

drop policy if exists "Assigned stylists submit LUXE proof" on public.cs_proof_of_service;
create policy "Assigned stylists submit LUXE proof"
on public.cs_proof_of_service for insert
to authenticated
with check (
  stylist_id = public.cs_current_stylist_id()
  and exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id and b.stylist_id = public.cs_current_stylist_id()
  )
);

drop policy if exists "Assigned stylists update LUXE proof" on public.cs_proof_of_service;
create policy "Assigned stylists update LUXE proof"
on public.cs_proof_of_service for update
to authenticated
using (stylist_id = public.cs_current_stylist_id())
with check (stylist_id = public.cs_current_stylist_id());

drop policy if exists "Booking participants read LUXE payments" on public.cs_payments;
create policy "Booking participants read LUXE payments"
on public.cs_payments for select
to authenticated
using (client_id = public.cs_current_user_id() or stylist_id = public.cs_current_stylist_id());

drop policy if exists "Booking participants read LUXE disputes" on public.cs_disputes;
create policy "Booking participants read LUXE disputes"
on public.cs_disputes for select
to authenticated
using (
  exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id
      and (b.client_id = public.cs_current_user_id() or b.stylist_id = public.cs_current_stylist_id())
  )
);

drop policy if exists "Booking participants create LUXE disputes" on public.cs_disputes;
create policy "Booking participants create LUXE disputes"
on public.cs_disputes for insert
to authenticated
with check (
  filed_by = public.cs_current_user_id()
  and exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id
      and (b.client_id = public.cs_current_user_id() or b.stylist_id = public.cs_current_stylist_id())
  )
);

drop policy if exists "Booking participants read LUXE safety events" on public.cs_safety_events;
create policy "Booking participants read LUXE safety events"
on public.cs_safety_events for select
to authenticated
using (
  reported_by = public.cs_current_user_id()
  or exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id
      and (b.client_id = public.cs_current_user_id() or b.stylist_id = public.cs_current_stylist_id())
  )
);

drop policy if exists "Users report LUXE safety events" on public.cs_safety_events;
create policy "Users report LUXE safety events"
on public.cs_safety_events for insert
to authenticated
with check (reported_by = public.cs_current_user_id());

drop policy if exists "Users create LUXE ratings" on public.cs_ratings;
create policy "Users create LUXE ratings"
on public.cs_ratings for insert
to authenticated
with check (
  rated_by = public.cs_current_user_id()
  and exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id
      and b.status = 'completed'
      and (b.client_id = public.cs_current_user_id() or b.stylist_id = public.cs_current_stylist_id())
  )
);

drop policy if exists "Authenticated read LUXE ratings" on public.cs_ratings;
create policy "Authenticated read LUXE ratings"
on public.cs_ratings for select
to authenticated
using (true);

drop policy if exists "Users manage own LUXE session shares" on public.cs_session_shares;
create policy "Users manage own LUXE session shares"
on public.cs_session_shares for all
to authenticated
using (shared_by = public.cs_current_user_id())
with check (
  shared_by = public.cs_current_user_id()
  and exists (
    select 1 from public.cs_bookings b
    where b.id = booking_id
      and (b.client_id = public.cs_current_user_id() or b.stylist_id = public.cs_current_stylist_id())
  )
);

drop policy if exists "Users read own LUXE notifications" on public.cs_notifications;
create policy "Users read own LUXE notifications"
on public.cs_notifications for select
to authenticated
using (user_id = public.cs_current_user_id());

drop policy if exists "Users update own LUXE notifications" on public.cs_notifications;
create policy "Users update own LUXE notifications"
on public.cs_notifications for update
to authenticated
using (user_id = public.cs_current_user_id())
with check (user_id = public.cs_current_user_id());

drop policy if exists "Users read own LUXE subscriptions" on public.cs_subscriptions;
create policy "Users read own LUXE subscriptions"
on public.cs_subscriptions for select
to authenticated
using (user_id = public.cs_current_user_id());

-- ---------------------------------------------------------------------------
-- Waitlist intake is validated through an RPC, not open table writes.
-- ---------------------------------------------------------------------------
revoke all on public.cs_waitlist from anon, authenticated;

create or replace function public.cs_join_waitlist(
  p_email text default null,
  p_phone text default null,
  p_name text default null,
  p_city text default null,
  p_interest text default null,
  p_source text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := lower(nullif(trim(p_email), ''));
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  if v_email is null and v_phone is null then
    raise exception 'Email or phone is required';
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'Invalid email';
  end if;
  if v_phone is not null and length(v_phone) not between 7 and 20 then
    raise exception 'Invalid phone';
  end if;
  if length(coalesce(p_name, '')) > 120 or length(coalesce(p_city, '')) > 120 then
    raise exception 'Input too long';
  end if;

  insert into public.cs_waitlist(email, phone, name, city, interest, source)
  values (v_email, v_phone, nullif(trim(p_name), ''), nullif(trim(p_city), ''),
          nullif(trim(p_interest), ''), nullif(trim(p_source), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.cs_join_waitlist(text, text, text, text, text, text) from public;
grant execute on function public.cs_join_waitlist(text, text, text, text, text, text) to anon, authenticated;

-- Sensitive operations remain server/command-center only.
revoke all on public.cs_integration_events from anon, authenticated;
revoke insert, update, delete on public.cs_booking_offers from anon, authenticated;
revoke insert, update, delete on public.cs_booking_events from anon, authenticated;
revoke all on public.cs_qa_issues from anon, authenticated;
revoke all on public.cs_promo_codes from anon, authenticated;

commit;
