-- Booking-specific Stripe Connect accounting for LUXE.
alter table public.cs_stylists
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_onboarding_complete boolean not null default false;

create table if not exists public.cs_booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.cs_bookings(id) on delete restrict,
  client_id uuid not null references public.cs_users(id) on delete restrict,
  stylist_id uuid not null references public.cs_stylists(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','requires_payment_method','requires_action','authorized','captured','released','canceled','refunded','partially_refunded','disputed','failed')),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  amount_cents integer not null check (amount_cents > 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  stylist_payout_cents integer not null check (stylist_payout_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  stripe_payment_intent_id text unique,
  stripe_charge_id text unique,
  stripe_transfer_id text unique,
  stripe_refund_id text,
  authorized_at timestamptz,
  captured_at timestamptz,
  released_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (platform_fee_cents + stylist_payout_cents = amount_cents)
);

create table if not exists public.cs_payment_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payment_intent_id text,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create index if not exists cs_booking_payments_client_idx on public.cs_booking_payments(client_id, created_at desc);
create index if not exists cs_booking_payments_stylist_idx on public.cs_booking_payments(stylist_id, created_at desc);

alter table public.cs_booking_payments enable row level security;
alter table public.cs_payment_events enable row level security;
drop policy if exists "LUXE clients read own payments" on public.cs_booking_payments;
create policy "LUXE clients read own payments" on public.cs_booking_payments for select to authenticated
using (client_id = (select id from public.cs_users where auth_id = auth.uid()));
drop policy if exists "LUXE stylists read assigned payments" on public.cs_booking_payments;
create policy "LUXE stylists read assigned payments" on public.cs_booking_payments for select to authenticated
using (stylist_id = (select id from public.cs_stylists where user_id = (select id from public.cs_users where auth_id = auth.uid())));
revoke all on public.cs_booking_payments, public.cs_payment_events from anon, authenticated;
grant select on public.cs_booking_payments to authenticated;

create or replace function public.cs_stylist_transition(p_booking_id uuid,p_status text)
returns public.cs_bookings language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_sid uuid;v_current text;v public.cs_bookings%rowtype;v_payment_status text;
begin
 select s.id into v_sid from public.cs_stylists s join public.cs_users u on u.id=s.user_id where u.auth_id=auth.uid() and s.verification_status='verified';
 if v_sid is null then raise exception 'Verified stylist profile required';end if;
 select status into v_current from public.cs_bookings where id=p_booking_id and stylist_id=v_sid for update;
 if not found then raise exception 'Assigned booking not found';end if;
 if not((v_current='accepted' and p_status='en_route')or(v_current='en_route' and p_status='arrived')or(v_current='arrived' and p_status='in_progress')or(v_current='in_progress' and p_status='completed'))then raise exception 'Invalid booking transition';end if;
 if p_status='en_route' then
   select status into v_payment_status from public.cs_booking_payments where booking_id=p_booking_id;
   if v_payment_status is distinct from 'authorized' then raise exception 'Customer payment authorization required before travel';end if;
 end if;
 update public.cs_bookings set status=p_status,en_route_at=case when p_status='en_route' then now() else en_route_at end,arrived_at=case when p_status='arrived' then now() else arrived_at end,started_at=case when p_status='in_progress' then now() else started_at end,completed_at=case when p_status='completed' then now() else completed_at end,final_price=case when p_status='completed' then estimated_price else final_price end,updated_at=now() where id=p_booking_id returning * into v;
 return v;
end;$$;
revoke execute on function public.cs_stylist_transition(uuid,text) from public,anon;
grant execute on function public.cs_stylist_transition(uuid,text) to authenticated;
