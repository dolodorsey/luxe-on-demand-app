-- LUXE ON DEMAND marketplace authorization and lifecycle.

create unique index if not exists cs_users_auth_id_unique on public.cs_users(auth_id) where auth_id is not null;
create unique index if not exists cs_stylists_user_id_unique on public.cs_stylists(user_id);
create unique index if not exists cs_ratings_booking_rater_unique on public.cs_ratings(booking_id,rated_by);
create index if not exists cs_bookings_client_idx on public.cs_bookings(client_id,created_at desc);
create index if not exists cs_bookings_stylist_idx on public.cs_bookings(stylist_id,created_at desc);

create or replace function public.cs_handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare v_parts text[];
begin
  v_parts:=regexp_split_to_array(trim(coalesce(new.raw_user_meta_data->>'full_name','')), '\s+');
  insert into public.cs_users(auth_id,role,first_name,last_name,email)
  values(new.id,'client',coalesce(v_parts[1],''),case when array_length(v_parts,1)>1 then array_to_string(v_parts[2:array_length(v_parts,1)],' ') else '' end,new.email)
  on conflict(auth_id) do nothing;
  return new;
end; $$;
revoke execute on function public.cs_handle_new_user() from public,anon,authenticated;
drop trigger if exists cs_on_auth_user_created on auth.users;
create trigger cs_on_auth_user_created after insert on auth.users for each row execute function public.cs_handle_new_user();

create policy "LUXE users read own profile" on public.cs_users for select to authenticated using(auth_id=(select auth.uid()));
create policy "LUXE users update own profile" on public.cs_users for update to authenticated using(auth_id=(select auth.uid())) with check(auth_id=(select auth.uid()));
revoke insert,delete,update on public.cs_users from anon,authenticated;
grant select on public.cs_users to authenticated;
grant update(first_name,last_name,phone,avatar_url,city,state,gender) on public.cs_users to authenticated;

create policy "LUXE clients read own bookings" on public.cs_bookings for select to authenticated
using(client_id=(select id from public.cs_users where auth_id=(select auth.uid())));
create policy "LUXE stylists read assigned bookings" on public.cs_bookings for select to authenticated
using(stylist_id=(select s.id from public.cs_stylists s join public.cs_users u on u.id=s.user_id where u.auth_id=(select auth.uid()) and u.role='stylist'));
revoke insert,update,delete on public.cs_bookings from anon,authenticated;
grant select on public.cs_bookings to authenticated;

create policy "LUXE stylists read own profile" on public.cs_stylists for select to authenticated
using(user_id=(select id from public.cs_users where auth_id=(select auth.uid()) and role='stylist'));
revoke insert,update,delete on public.cs_stylists from anon,authenticated;
grant select on public.cs_stylists to authenticated;

create policy "LUXE users read their ratings" on public.cs_ratings for select to authenticated
using(rated_by=(select id from public.cs_users where auth_id=(select auth.uid())) or rated_user=(select id from public.cs_users where auth_id=(select auth.uid())));
revoke insert,update,delete on public.cs_ratings from anon,authenticated;
grant select on public.cs_ratings to authenticated;

create policy "LUXE users read catalog" on public.cs_categories for select to authenticated,anon using(is_active=true);
create policy "LUXE users read service catalog" on public.cs_subcategories for select to authenticated,anon using(is_active=true);
grant select on public.cs_categories,public.cs_subcategories to anon,authenticated;

create or replace function public.cs_request_booking(p_service_name text,p_service_mode text,p_address text default null,p_lat double precision default null,p_lng double precision default null,p_scheduled_at timestamptz default null,p_notes text default null)
returns public.cs_bookings language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_client public.cs_users%rowtype;v_service public.cs_subcategories%rowtype;v_booking public.cs_bookings%rowtype;
begin
 select * into v_client from public.cs_users where auth_id=auth.uid() and role='client' and status='active';
 if not found then raise exception 'Active client account required';end if;
 if p_service_mode not in('mobile','in_studio') then raise exception 'Invalid service mode';end if;
 select * into v_service from public.cs_subcategories where name=p_service_name and is_active order by id limit 1;
 if not found then raise exception 'Service is unavailable';end if;
 if p_service_mode='mobile' and not coalesce(v_service.mobile_available,false) then raise exception 'Mobile service unavailable';end if;
 if p_service_mode='in_studio' and not coalesce(v_service.in_studio_available,false) then raise exception 'Studio service unavailable';end if;
 if p_service_mode='mobile' and coalesce(length(trim(p_address)),0)<3 then raise exception 'A service address is required';end if;
 insert into public.cs_bookings(client_id,category_id,subcategory_id,status,service_mode,service_address,service_lat,service_lng,estimated_price,final_price,booking_type,scheduled_at,client_notes)
 values(v_client.id,v_service.category_id,v_service.id,'requested',p_service_mode,case when p_service_mode='mobile' then trim(p_address) end,p_lat,p_lng,coalesce(v_service.base_price,0)+case when p_service_mode='mobile' then coalesce(v_service.mobile_fee,0) else 0 end,null,case when p_scheduled_at is null then 'on_demand' else 'scheduled' end,p_scheduled_at,left(p_notes,1000)) returning * into v_booking;
 return v_booking;
end; $$;

create or replace function public.cs_set_on_duty(p_on_duty boolean,p_lat double precision default null,p_lng double precision default null)
returns public.cs_stylists language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.cs_stylists%rowtype;
begin
 update public.cs_stylists s set on_duty=p_on_duty,current_lat=case when p_on_duty then p_lat else null end,current_lng=case when p_on_duty then p_lng else null end,last_location_at=case when p_on_duty then now() else s.last_location_at end,updated_at=now()
 where s.user_id=(select id from public.cs_users where auth_id=auth.uid() and role='stylist' and status='active') and s.license_verified and s.id_verified and s.bg_check_passed and s.insurance_verified returning * into v;
 if not found then raise exception 'Fully verified stylist account required';end if;return v;
end; $$;

create or replace function public.cs_available_requests()
returns table(id uuid,subcategory_id text,service_mode text,estimated_price numeric,scheduled_at timestamptz,created_at timestamptz)
language sql security definer set search_path=pg_catalog,public stable as $$
 select b.id,b.subcategory_id,b.service_mode,b.estimated_price,b.scheduled_at,b.created_at from public.cs_bookings b
 where b.status='requested' and b.stylist_id is null and exists(select 1 from public.cs_stylists s join public.cs_users u on u.id=s.user_id where u.auth_id=auth.uid() and u.role='stylist' and u.status='active' and s.on_duty and s.license_verified and s.id_verified and s.bg_check_passed and s.insurance_verified)
 order by b.created_at limit 20;
$$;

create or replace function public.cs_accept_request(p_booking_id uuid) returns public.cs_bookings language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_stylist uuid;v public.cs_bookings%rowtype;
begin
 select s.id into v_stylist from public.cs_stylists s join public.cs_users u on u.id=s.user_id where u.auth_id=auth.uid() and u.role='stylist' and u.status='active' and s.on_duty and s.license_verified and s.id_verified and s.bg_check_passed and s.insurance_verified;
 if v_stylist is null then raise exception 'Verified on-duty stylist required';end if;
 update public.cs_bookings set stylist_id=v_stylist,status='accepted',accepted_at=now(),matched_at=now(),updated_at=now() where id=p_booking_id and status='requested' and stylist_id is null returning * into v;
 if not found then raise exception 'Request is no longer available';end if;return v;
end; $$;

create or replace function public.cs_stylist_transition(p_booking_id uuid,p_status text) returns public.cs_bookings language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_sid uuid;v_current text;v public.cs_bookings%rowtype;
begin
 select s.id into v_sid from public.cs_stylists s join public.cs_users u on u.id=s.user_id where u.auth_id=auth.uid() and u.role='stylist' and u.status='active' and s.license_verified and s.id_verified and s.bg_check_passed;
 select status into v_current from public.cs_bookings where id=p_booking_id and stylist_id=v_sid for update;
 if not found then raise exception 'Assigned booking not found';end if;
 if not((v_current='accepted' and p_status='en_route')or(v_current='en_route' and p_status='arrived')or(v_current='arrived' and p_status='in_progress')or(v_current='in_progress' and p_status='completed'))then raise exception 'Invalid booking transition';end if;
 update public.cs_bookings set status=p_status,en_route_at=case when p_status='en_route' then now() else en_route_at end,arrived_at=case when p_status='arrived' then now() else arrived_at end,started_at=case when p_status='in_progress' then now() else started_at end,completed_at=case when p_status='completed' then now() else completed_at end,final_price=case when p_status='completed' then estimated_price else final_price end,updated_at=now() where id=p_booking_id returning * into v;return v;
end; $$;

create or replace function public.cs_client_cancel(p_booking_id uuid,p_reason text default null) returns public.cs_bookings language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.cs_bookings%rowtype;begin update public.cs_bookings set status='canceled',canceled_at=now(),canceled_by='client',cancel_reason=left(p_reason,500),updated_at=now() where id=p_booking_id and client_id=(select id from public.cs_users where auth_id=auth.uid()) and status in('requested','matched','accepted') returning * into v;if not found then raise exception 'Booking cannot be canceled';end if;return v;end;$$;

create or replace function public.cs_rate_booking(p_booking_id uuid,p_rating integer,p_review text default null) returns public.cs_ratings language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_client uuid;v_stylist_user uuid;v public.cs_ratings%rowtype;begin if p_rating<1 or p_rating>5 then raise exception 'Rating must be 1 through 5';end if;select b.client_id,s.user_id into v_client,v_stylist_user from public.cs_bookings b join public.cs_stylists s on s.id=b.stylist_id join public.cs_users u on u.id=b.client_id where b.id=p_booking_id and b.status='completed' and u.auth_id=auth.uid();if v_client is null then raise exception 'Completed booking not found';end if;insert into public.cs_ratings(booking_id,rated_by,rated_user,rating,review)values(p_booking_id,v_client,v_stylist_user,p_rating,left(p_review,1000)) returning * into v;return v;end;$$;

do $$declare r record;begin for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('cs_request_booking','cs_set_on_duty','cs_available_requests','cs_accept_request','cs_stylist_transition','cs_client_cancel','cs_rate_booking') loop execute format('revoke execute on function %s from public,anon',r.sig);execute format('grant execute on function %s to authenticated',r.sig);end loop;end$$;

create sequence if not exists public.luxe_provider_application_number_seq;
create table if not exists public.luxe_provider_applications(id uuid primary key default gen_random_uuid(),application_number text not null unique default('LUXE-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('public.luxe_provider_application_number_seq')::text,6,'0')),first_name text not null,last_name text not null,email text not null,phone text not null,city text not null,state_code text not null,zip_code text,services_requested text[] not null,years_experience integer not null,experience_description text,has_vehicle boolean not null default false,vehicle_type text,background_check_consent boolean not null,portfolio_url text,status text not null default'submitted' check(status in('submitted','reviewing','approved','rejected','withdrawn')),source_ip_hash text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.luxe_provider_applications enable row level security;
revoke all on public.luxe_provider_applications from public,anon,authenticated;
revoke all on sequence public.luxe_provider_application_number_seq from public,anon,authenticated;
create index if not exists luxe_provider_applications_email_created_idx on public.luxe_provider_applications(lower(email),created_at desc);
