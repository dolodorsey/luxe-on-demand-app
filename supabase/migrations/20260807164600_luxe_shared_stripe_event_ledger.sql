create table if not exists public.lm_payment_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payment_id uuid references public.lm_payments(id) on delete set null,
  ride_id uuid references public.lm_rides(id) on delete set null,
  livemode boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lm_payment_events_payment_idx
  on public.lm_payment_events(payment_id, created_at desc);

create index if not exists lm_payment_events_ride_idx
  on public.lm_payment_events(ride_id, created_at desc);

alter table public.lm_payment_events enable row level security;
revoke all on public.lm_payment_events from anon, authenticated;
