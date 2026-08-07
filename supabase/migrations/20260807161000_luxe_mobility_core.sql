create extension if not exists pgcrypto;

create table if not exists public.lm_vehicle_classes (
  id text primary key,
  name text not null,
  description text,
  base_fare numeric(10,2) not null check(base_fare>=0),
  per_mile numeric(10,2) not null check(per_mile>=0),
  per_minute numeric(10,2) not null check(per_minute>=0),
  minimum_fare numeric(10,2) not null check(minimum_fare>=0),
  capacity smallint not null check(capacity between 1 and 12),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.lm_vehicle_classes(id,name,description,base_fare,per_mile,per_minute,minimum_fare,capacity,sort_order)
values
('luxe_black','LUXE Black','Premium black-car sedan',8,2.75,.55,18,4,10),
('luxe_suv','LUXE SUV','Premium SUV for groups and luggage',12,3.75,.70,28,6,20),
('luxe_exec','LUXE Executive','Executive-level sedan and chauffeur experience',18,4.50,.90,40,4,30)
on conflict(id) do update set name=excluded.name,description=excluded.description,base_fare=excluded.base_fare,per_mile=excluded.per_mile,per_minute=excluded.per_minute,minimum_fare=excluded.minimum_fare,capacity=excluded.capacity,sort_order=excluded.sort_order,is_active=true,updated_at=now();

create table if not exists public.lm_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique not null,
  role text not null default 'rider' check(role in ('rider','driver','admin')),
  full_name text not null,
  phone text,
  status text not null default 'active' check(status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lm_drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references public.lm_profiles(id) on delete cascade,
  approval_status text not null default 'pending' check(approval_status in ('pending','approved','suspended','rejected')),
  on_duty boolean not null default false,
  vehicle_class_id text references public.lm_vehicle_classes(id),
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  vehicle_plate text,
  latitude double precision,
  longitude double precision,
  last_location_at timestamptz,
  rating numeric(3,2) not null default 5.00,
  completed_rides integer not null default 0,
  stripe_account_id text,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lm_rides (
  id uuid primary key default gen_random_uuid(),
  rider_profile_id uuid not null references public.lm_profiles(id),
  driver_id uuid references public.lm_drivers(id),
  vehicle_class_id text not null references public.lm_vehicle_classes(id),
  pickup_address text not null,
  destination_address text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  route_distance_miles numeric(8,2) not null check(route_distance_miles>0),
  route_duration_minutes integer not null check(route_duration_minutes>0),
  quoted_fare numeric(10,2) not null check(quoted_fare>=0),
  final_fare numeric(10,2),
  status text not null default 'matching' check(status in ('matching','accepted','en_route','arrived','in_progress','completed','canceled')),
  scheduled_at timestamptz,
  accepted_at timestamptz,
  en_route_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lm_ride_events (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.lm_rides(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.lm_profiles(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lm_payments (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid unique not null references public.lm_rides(id) on delete cascade,
  rider_profile_id uuid not null references public.lm_profiles(id),
  amount_authorized integer not null default 0,
  amount_captured integer not null default 0,
  amount_refunded integer not null default 0,
  currency text not null default 'usd',
  status text not null default 'pending' check(status in ('pending','authorized','captured','failed','canceled','partially_refunded','refunded')),
  stripe_payment_intent_id text,
  authorized_at timestamptz,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lm_ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid unique not null references public.lm_rides(id) on delete cascade,
  rider_profile_id uuid not null references public.lm_profiles(id),
  driver_id uuid not null references public.lm_drivers(id),
  rating smallint not null check(rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists lm_rides_matching_idx on public.lm_rides(vehicle_class_id,created_at) where status='matching' and driver_id is null;
create index if not exists lm_rides_rider_idx on public.lm_rides(rider_profile_id,created_at desc);
create index if not exists lm_rides_driver_idx on public.lm_rides(driver_id,created_at desc) where driver_id is not null;
create index if not exists lm_drivers_supply_idx on public.lm_drivers(vehicle_class_id,on_duty,approval_status) where approval_status='approved';

alter table public.lm_vehicle_classes enable row level security;
alter table public.lm_profiles enable row level security;
alter table public.lm_drivers enable row level security;
alter table public.lm_rides enable row level security;
alter table public.lm_ride_events enable row level security;
alter table public.lm_payments enable row level security;
alter table public.lm_ratings enable row level security;

drop policy if exists lm_vehicle_classes_public_read on public.lm_vehicle_classes;
create policy lm_vehicle_classes_public_read on public.lm_vehicle_classes for select to anon,authenticated using(is_active);

drop policy if exists lm_profiles_own_read on public.lm_profiles;
create policy lm_profiles_own_read on public.lm_profiles for select to authenticated using(auth_id=auth.uid());

drop policy if exists lm_rides_participant_read on public.lm_rides;
create policy lm_rides_participant_read on public.lm_rides for select to authenticated using(
  rider_profile_id in (select id from public.lm_profiles where auth_id=auth.uid())
  or driver_id in (select d.id from public.lm_drivers d join public.lm_profiles p on p.id=d.profile_id where p.auth_id=auth.uid())
);

drop policy if exists lm_payments_rider_read on public.lm_payments;
create policy lm_payments_rider_read on public.lm_payments for select to authenticated using(
  rider_profile_id in (select id from public.lm_profiles where auth_id=auth.uid())
);

drop policy if exists lm_ratings_rider_read on public.lm_ratings;
create policy lm_ratings_rider_read on public.lm_ratings for select to authenticated using(
  rider_profile_id in (select id from public.lm_profiles where auth_id=auth.uid())
);

create or replace function public.lm_current_profile_id()
returns uuid language sql stable security definer set search_path='pg_catalog','public' as $$
  select id from public.lm_profiles where auth_id=auth.uid() and status='active' limit 1;
$$;

create or replace function public.lm_upsert_rider_profile(p_full_name text,p_phone text default null)
returns public.lm_profiles language plpgsql security definer set search_path='pg_catalog','public' as $$
declare v public.lm_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if coalesce(length(trim(p_full_name)),0)<2 then raise exception 'Full name is required'; end if;
  insert into public.lm_profiles(auth_id,role,full_name,phone,status)
  values(auth.uid(),'rider',trim(p_full_name),nullif(trim(p_phone),''),'active')
  on conflict(auth_id) do update set full_name=excluded.full_name,phone=excluded.phone,updated_at=now()
  returning * into v;
  if v.role not in ('rider','admin') then raise exception 'Driver profiles cannot use the rider onboarding flow'; end if;
  return v;
end;$$;

create or replace function public.lm_quote_fare(p_vehicle_class_id text,p_distance_miles numeric,p_duration_minutes integer)
returns numeric language plpgsql stable security definer set search_path='pg_catalog','public' as $$
declare v public.lm_vehicle_classes%rowtype; q numeric;
begin
  if p_distance_miles is null or p_distance_miles<=0 or p_distance_miles>500 then raise exception 'Route distance is invalid'; end if;
  if p_duration_minutes is null or p_duration_minutes<=0 or p_duration_minutes>1440 then raise exception 'Route duration is invalid'; end if;
  select * into v from public.lm_vehicle_classes where id=p_vehicle_class_id and is_active;
  if not found then raise exception 'Vehicle class is unavailable'; end if;
  q:=greatest(v.minimum_fare,v.base_fare+(v.per_mile*p_distance_miles)+(v.per_minute*p_duration_minutes));
  return round(q,2);
end;$$;

create or replace function public.lm_request_ride(
  p_vehicle_class_id text,p_pickup_address text,p_destination_address text,
  p_distance_miles numeric,p_duration_minutes integer,
  p_pickup_lat double precision default null,p_pickup_lng double precision default null,
  p_destination_lat double precision default null,p_destination_lng double precision default null,
  p_scheduled_at timestamptz default null
)
returns public.lm_rides language plpgsql security definer set search_path='pg_catalog','public' as $$
declare rider_id uuid; fare numeric; ride public.lm_rides%rowtype;
begin
  rider_id:=public.lm_current_profile_id();
  if rider_id is null then raise exception 'Active LUXE rider profile required' using errcode='42501'; end if;
  if coalesce(length(trim(p_pickup_address)),0)<3 or coalesce(length(trim(p_destination_address)),0)<3 then raise exception 'Pickup and destination are required'; end if;
  if not exists(select 1 from public.lm_drivers where approval_status='approved' and on_duty and vehicle_class_id=p_vehicle_class_id) then
    raise exception 'No verified LUXE driver is available for this vehicle class right now';
  end if;
  fare:=public.lm_quote_fare(p_vehicle_class_id,p_distance_miles,p_duration_minutes);
  insert into public.lm_rides(rider_profile_id,vehicle_class_id,pickup_address,destination_address,pickup_lat,pickup_lng,destination_lat,destination_lng,route_distance_miles,route_duration_minutes,quoted_fare,scheduled_at,status)
  values(rider_id,p_vehicle_class_id,trim(p_pickup_address),trim(p_destination_address),p_pickup_lat,p_pickup_lng,p_destination_lat,p_destination_lng,p_distance_miles,p_duration_minutes,fare,p_scheduled_at,'matching')
  returning * into ride;
  insert into public.lm_ride_events(ride_id,event_type,actor_profile_id,details) values(ride.id,'ride_requested',rider_id,jsonb_build_object('quoted_fare',fare));
  return ride;
end;$$;

create or replace function public.lm_available_rides()
returns setof public.lm_rides language sql stable security definer set search_path='pg_catalog','public' as $$
  with me as (
    select d.id,d.vehicle_class_id from public.lm_drivers d join public.lm_profiles p on p.id=d.profile_id
    where p.auth_id=auth.uid() and p.status='active' and d.approval_status='approved' and d.on_duty limit 1
  )
  select r.* from public.lm_rides r join me on me.vehicle_class_id=r.vehicle_class_id
  where r.status='matching' and r.driver_id is null order by r.created_at limit 20;
$$;

create or replace function public.lm_accept_ride(p_ride_id uuid)
returns public.lm_rides language plpgsql security definer set search_path='pg_catalog','public' as $$
declare driver_id uuid; profile_id uuid; ride public.lm_rides%rowtype;
begin
  select d.id,p.id into driver_id,profile_id from public.lm_drivers d join public.lm_profiles p on p.id=d.profile_id
  where p.auth_id=auth.uid() and p.status='active' and d.approval_status='approved' and d.on_duty and d.payouts_enabled limit 1;
  if driver_id is null then raise exception 'Approved, payout-ready, on-duty LUXE driver required' using errcode='42501'; end if;
  update public.lm_rides r set driver_id=driver_id,status='accepted',accepted_at=now(),updated_at=now()
  where r.id=p_ride_id and r.status='matching' and r.driver_id is null
    and r.vehicle_class_id=(select vehicle_class_id from public.lm_drivers where id=driver_id)
  returning * into ride;
  if not found then raise exception 'Ride is no longer available'; end if;
  insert into public.lm_ride_events(ride_id,event_type,actor_profile_id) values(ride.id,'driver_accepted',profile_id);
  return ride;
end;$$;

create or replace function public.lm_driver_transition(p_ride_id uuid,p_status text)
returns public.lm_rides language plpgsql security definer set search_path='pg_catalog','public' as $$
declare driver_id uuid; profile_id uuid; current_status text; ride public.lm_rides%rowtype;
begin
  select d.id,p.id into driver_id,profile_id from public.lm_drivers d join public.lm_profiles p on p.id=d.profile_id where p.auth_id=auth.uid() and p.status='active' and d.approval_status='approved' limit 1;
  if driver_id is null then raise exception 'Approved LUXE driver required' using errcode='42501'; end if;
  select status into current_status from public.lm_rides where id=p_ride_id and driver_id=driver_id for update;
  if current_status is null then raise exception 'Assigned ride not found'; end if;
  if p_status='en_route' and current_status<>'accepted' then raise exception 'Invalid ride transition'; end if;
  if p_status='arrived' and current_status<>'en_route' then raise exception 'Invalid ride transition'; end if;
  if p_status='in_progress' and current_status<>'arrived' then raise exception 'Invalid ride transition'; end if;
  if p_status='completed' and current_status<>'in_progress' then raise exception 'Invalid ride transition'; end if;
  if p_status='en_route' and not exists(select 1 from public.lm_payments where ride_id=p_ride_id and status='authorized') then raise exception 'Payment authorization required before travel begins'; end if;
  update public.lm_rides set status=p_status,updated_at=now(),
    en_route_at=case when p_status='en_route' then now() else en_route_at end,
    arrived_at=case when p_status='arrived' then now() else arrived_at end,
    started_at=case when p_status='in_progress' then now() else started_at end,
    completed_at=case when p_status='completed' then now() else completed_at end,
    final_fare=case when p_status='completed' then quoted_fare else final_fare end
  where id=p_ride_id returning * into ride;
  insert into public.lm_ride_events(ride_id,event_type,actor_profile_id) values(ride.id,p_status,profile_id);
  if p_status='completed' then update public.lm_drivers set completed_rides=completed_rides+1,updated_at=now() where id=driver_id; end if;
  return ride;
end;$$;

create or replace function public.lm_cancel_ride(p_ride_id uuid,p_reason text default null)
returns public.lm_rides language plpgsql security definer set search_path='pg_catalog','public' as $$
declare rider_id uuid; ride public.lm_rides%rowtype;
begin
  rider_id:=public.lm_current_profile_id();
  update public.lm_rides set status='canceled',canceled_at=now(),cancellation_reason=left(nullif(trim(p_reason),''),500),updated_at=now()
  where id=p_ride_id and rider_profile_id=rider_id and status in ('matching','accepted','en_route') returning * into ride;
  if not found then raise exception 'Ride cannot be canceled in its current state'; end if;
  insert into public.lm_ride_events(ride_id,event_type,actor_profile_id,details) values(ride.id,'ride_canceled',rider_id,jsonb_build_object('reason',p_reason));
  return ride;
end;$$;

create or replace function public.lm_rate_ride(p_ride_id uuid,p_rating integer,p_comment text default null)
returns public.lm_ratings language plpgsql security definer set search_path='pg_catalog','public' as $$
declare rider_id uuid; driver_id uuid; result public.lm_ratings%rowtype;
begin
  rider_id:=public.lm_current_profile_id();
  if p_rating<1 or p_rating>5 then raise exception 'Rating must be 1 through 5'; end if;
  select r.driver_id into driver_id from public.lm_rides r where r.id=p_ride_id and r.rider_profile_id=rider_id and r.status='completed';
  if driver_id is null then raise exception 'Completed rider-owned trip required'; end if;
  insert into public.lm_ratings(ride_id,rider_profile_id,driver_id,rating,comment)
  values(p_ride_id,rider_id,driver_id,p_rating,left(nullif(trim(p_comment),''),1000))
  on conflict(ride_id) do update set rating=excluded.rating,comment=excluded.comment
  returning * into result;
  update public.lm_drivers d set rating=(select round(avg(rating)::numeric,2) from public.lm_ratings where driver_id=d.id),updated_at=now() where d.id=driver_id;
  return result;
end;$$;

revoke all on function public.lm_upsert_rider_profile(text,text) from public,anon;
revoke all on function public.lm_request_ride(text,text,text,numeric,integer,double precision,double precision,double precision,double precision,timestamptz) from public,anon;
revoke all on function public.lm_available_rides() from public,anon;
revoke all on function public.lm_accept_ride(uuid) from public,anon;
revoke all on function public.lm_driver_transition(uuid,text) from public,anon;
revoke all on function public.lm_cancel_ride(uuid,text) from public,anon;
revoke all on function public.lm_rate_ride(uuid,integer,text) from public,anon;

grant execute on function public.lm_upsert_rider_profile(text,text) to authenticated;
grant execute on function public.lm_quote_fare(text,numeric,integer) to anon,authenticated;
grant execute on function public.lm_request_ride(text,text,text,numeric,integer,double precision,double precision,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.lm_available_rides() to authenticated;
grant execute on function public.lm_accept_ride(uuid) to authenticated;
grant execute on function public.lm_driver_transition(uuid,text) to authenticated;
grant execute on function public.lm_cancel_ride(uuid,text) to authenticated;
grant execute on function public.lm_rate_ride(uuid,integer,text) to authenticated;
