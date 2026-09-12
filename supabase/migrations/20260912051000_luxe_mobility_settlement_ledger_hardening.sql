alter table public.lm_payments
  add column if not exists driver_id uuid references public.lm_drivers(id) on delete set null,
  add column if not exists platform_fee_bps integer,
  add column if not exists platform_fee_amount integer,
  add column if not exists driver_payout_amount integer,
  add column if not exists stripe_charge_id text,
  add column if not exists stripe_transfer_id text,
  add column if not exists stripe_refund_id text,
  add column if not exists stripe_dispute_id text,
  add column if not exists released_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists disputed_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists failure_message text;

alter table public.lm_payments drop constraint if exists lm_payments_platform_fee_bps_check;
alter table public.lm_payments
  add constraint lm_payments_platform_fee_bps_check
  check (platform_fee_bps is null or platform_fee_bps between 0 and 10000);

alter table public.lm_payments drop constraint if exists lm_payments_split_check;
alter table public.lm_payments
  add constraint lm_payments_split_check
  check (
    (platform_fee_amount is null or platform_fee_amount >= 0)
    and (driver_payout_amount is null or driver_payout_amount >= 0)
    and (
      platform_fee_amount is null
      or driver_payout_amount is null
      or platform_fee_amount + driver_payout_amount <= greatest(amount_captured, amount_authorized)
    )
  );

alter table public.lm_payments drop constraint if exists lm_payments_status_check;
alter table public.lm_payments
  add constraint lm_payments_status_check
  check (status in (
    'pending','authorized','capture_pending','captured','transfer_pending','released',
    'failed','canceled','partially_refunded','refunded','disputed'
  ));

create unique index if not exists lm_payments_intent_uidx
  on public.lm_payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create unique index if not exists lm_payments_transfer_uidx
  on public.lm_payments(stripe_transfer_id)
  where stripe_transfer_id is not null;
create index if not exists lm_payments_driver_idx
  on public.lm_payments(driver_id, created_at desc)
  where driver_id is not null;
create index if not exists lm_payments_settlement_retry_idx
  on public.lm_payments(updated_at)
  where status in ('capture_pending','transfer_pending');

create table if not exists public.lm_runtime_config (
  key text primary key,
  value_text text,
  value_integer bigint,
  description text,
  updated_at timestamptz not null default now()
);
alter table public.lm_runtime_config enable row level security;
revoke all on public.lm_runtime_config from anon, authenticated;

insert into public.lm_runtime_config(key, value_integer, description)
values(
  'platform_fee_bps',
  null,
  'LUXE mobility platform fee in basis points. Transfers fail closed until explicitly configured.'
)
on conflict(key) do update set description = excluded.description;

create or replace function public.lm_get_runtime_integer(p_key text)
returns bigint
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select value_integer
  from public.lm_runtime_config
  where key = p_key
  limit 1;
$$;
revoke all on function public.lm_get_runtime_integer(text) from public, anon, authenticated;
grant execute on function public.lm_get_runtime_integer(text) to service_role;
