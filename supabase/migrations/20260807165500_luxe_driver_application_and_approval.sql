create table if not exists public.lm_driver_applications (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique,
  full_name text not null,
  email text,
  phone text,
  city text not null,
  state_code text not null,
  vehicle_class_id text not null references public.lm_vehicle_classes(id),
  vehicle_make text not null,
  vehicle_model text not null,
  vehicle_year integer not null check (vehicle_year between 1990 and 2100),
  vehicle_color text not null,
  vehicle_plate text not null,
  driver_license_status text not null default 'pending' check (driver_license_status in ('pending','verified','rejected')),
  insurance_status text not null default 'pending' check (insurance_status in ('pending','verified','rejected')),
  background_status text not null default 'pending' check (background_status in ('pending','verified','rejected')),
  vehicle_status text not null default 'pending' check (vehicle_status in ('pending','verified','rejected')),
  application_status text not null default 'submitted' check (application_status in ('submitted','under_review','approved','rejected','withdrawn')),
  applicant_note text,
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lm_driver_applications_status_idx on public.lm_driver_applications(application_status, submitted_at desc);
create index if not exists lm_driver_applications_market_idx on public.lm_driver_applications(city, state_code, application_status);

alter table public.lm_driver_applications enable row level security;
drop policy if exists lm_driver_applications_own_read on public.lm_driver_applications;
create policy lm_driver_applications_own_read on public.lm_driver_applications for select to authenticated using (auth_id = auth.uid());

create or replace function public.lm_is_operator()
returns boolean language sql stable security definer set search_path='pg_catalog','public' as $$
  select coalesce((auth.jwt()->'app_metadata'->'portal_roles') ? 'owner', false)
    or exists (select 1 from public.org_members where user_id=auth.uid() and status='active' and role in ('owner','admin'));
$$;

create or replace function public.lm_submit_driver_application(
  p_full_name text,p_email text,p_phone text,p_city text,p_state_code text,p_vehicle_class_id text,
  p_vehicle_make text,p_vehicle_model text,p_vehicle_year integer,p_vehicle_color text,p_vehicle_plate text,p_applicant_note text default null
)
returns public.lm_driver_applications language plpgsql security definer set search_path='pg_catalog','public' as $$
declare v public.lm_driver_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if coalesce(length(trim(p_full_name)),0)<2 then raise exception 'Full name is required'; end if;
  if coalesce(length(trim(p_city)),0)<2 or coalesce(length(trim(p_state_code)),0)<2 then raise exception 'City and state are required'; end if;
  if not exists(select 1 from public.lm_vehicle_classes where id=p_vehicle_class_id and is_active) then raise exception 'Vehicle class is unavailable'; end if;
  if coalesce(length(trim(p_vehicle_make)),0)<2 or coalesce(length(trim(p_vehicle_model)),0)<1 or coalesce(length(trim(p_vehicle_plate)),0)<2 then raise exception 'Complete vehicle information is required'; end if;
  if p_vehicle_year < extract(year from now())::int - 20 or p_vehicle_year > extract(year from now())::int + 1 then raise exception 'Vehicle year is outside the current LUXE review range'; end if;

  insert into public.lm_driver_applications(
    auth_id,full_name,email,phone,city,state_code,vehicle_class_id,vehicle_make,vehicle_model,vehicle_year,vehicle_color,vehicle_plate,
    application_status,driver_license_status,insurance_status,background_status,vehicle_status,applicant_note,submitted_at,updated_at
  ) values (
    auth.uid(),trim(p_full_name),nullif(trim(p_email),''),nullif(trim(p_phone),''),trim(p_city),upper(trim(p_state_code)),p_vehicle_class_id,
    trim(p_vehicle_make),trim(p_vehicle_model),p_vehicle_year,trim(p_vehicle_color),upper(trim(p_vehicle_plate)),
    'submitted','pending','pending','pending','pending',left(nullif(trim(p_applicant_note),''),2000),now(),now()
  )
  on conflict(auth_id) do update set
    full_name=excluded.full_name,email=excluded.email,phone=excluded.phone,city=excluded.city,state_code=excluded.state_code,
    vehicle_class_id=excluded.vehicle_class_id,vehicle_make=excluded.vehicle_make,vehicle_model=excluded.vehicle_model,
    vehicle_year=excluded.vehicle_year,vehicle_color=excluded.vehicle_color,vehicle_plate=excluded.vehicle_plate,applicant_note=excluded.applicant_note,
    application_status=case when public.lm_driver_applications.application_status='approved' then 'approved' else 'submitted' end,
    driver_license_status=case when public.lm_driver_applications.application_status='approved' then public.lm_driver_applications.driver_license_status else 'pending' end,
    insurance_status=case when public.lm_driver_applications.application_status='approved' then public.lm_driver_applications.insurance_status else 'pending' end,
    background_status=case when public.lm_driver_applications.application_status='approved' then public.lm_driver_applications.background_status else 'pending' end,
    vehicle_status=case when public.lm_driver_applications.application_status='approved' then public.lm_driver_applications.vehicle_status else 'pending' end,
    submitted_at=case when public.lm_driver_applications.application_status='approved' then public.lm_driver_applications.submitted_at else now() end,
    updated_at=now()
  returning * into v;

  if v.application_status='approved' then raise exception 'Approved drivers must contact operations to change verified vehicle details'; end if;
  return v;
end;
$$;

create or replace function public.lm_review_driver_application(
  p_application_id uuid,p_driver_license_status text,p_insurance_status text,p_background_status text,p_vehicle_status text,
  p_decision text default 'under_review',p_review_note text default null
)
returns public.lm_driver_applications language plpgsql security definer set search_path='pg_catalog','public' as $$
declare v public.lm_driver_applications%rowtype;
begin
  if not public.lm_is_operator() then raise exception 'LUXE operator access required' using errcode='42501'; end if;
  if p_driver_license_status not in ('pending','verified','rejected') or p_insurance_status not in ('pending','verified','rejected') or p_background_status not in ('pending','verified','rejected') or p_vehicle_status not in ('pending','verified','rejected') then raise exception 'Invalid verification status'; end if;
  if p_decision not in ('under_review','rejected') then raise exception 'Review decision must be under_review or rejected'; end if;
  update public.lm_driver_applications set driver_license_status=p_driver_license_status,insurance_status=p_insurance_status,background_status=p_background_status,
    vehicle_status=p_vehicle_status,application_status=p_decision,review_note=left(nullif(trim(p_review_note),''),2000),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=p_application_id and application_status<>'approved' returning * into v;
  if not found then raise exception 'Driver application not found or already approved'; end if;
  return v;
end;
$$;

create or replace function public.lm_approve_driver_application(p_application_id uuid,p_review_note text default null)
returns public.lm_drivers language plpgsql security definer set search_path='pg_catalog','public' as $$
declare a public.lm_driver_applications%rowtype; p public.lm_profiles%rowtype; d public.lm_drivers%rowtype;
begin
  if not public.lm_is_operator() then raise exception 'LUXE operator access required' using errcode='42501'; end if;
  select * into a from public.lm_driver_applications where id=p_application_id for update;
  if not found then raise exception 'Driver application not found'; end if;
  if a.application_status='rejected' then raise exception 'Rejected application must be returned to review before approval'; end if;
  if a.driver_license_status<>'verified' or a.insurance_status<>'verified' or a.background_status<>'verified' or a.vehicle_status<>'verified' then raise exception 'All driver, insurance, background, and vehicle checks must be verified before approval'; end if;

  insert into public.lm_profiles(auth_id,role,full_name,phone,status) values(a.auth_id,'driver',a.full_name,a.phone,'active')
  on conflict(auth_id) do update set role='driver',full_name=excluded.full_name,phone=excluded.phone,status='active',updated_at=now() returning * into p;

  insert into public.lm_drivers(profile_id,approval_status,on_duty,vehicle_class_id,vehicle_make,vehicle_model,vehicle_color,vehicle_plate,payouts_enabled)
  values(p.id,'approved',false,a.vehicle_class_id,a.vehicle_make,a.vehicle_model,a.vehicle_color,a.vehicle_plate,false)
  on conflict(profile_id) do update set approval_status='approved',on_duty=false,vehicle_class_id=excluded.vehicle_class_id,vehicle_make=excluded.vehicle_make,
    vehicle_model=excluded.vehicle_model,vehicle_color=excluded.vehicle_color,vehicle_plate=excluded.vehicle_plate,payouts_enabled=false,updated_at=now()
  returning * into d;

  update public.lm_driver_applications set application_status='approved',review_note=left(nullif(trim(p_review_note),''),2000),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=a.id;
  return d;
end;
$$;

revoke all on function public.lm_is_operator() from public, anon;
revoke all on function public.lm_submit_driver_application(text,text,text,text,text,text,text,text,integer,text,text,text) from public, anon;
revoke all on function public.lm_review_driver_application(uuid,text,text,text,text,text,text) from public, anon;
revoke all on function public.lm_approve_driver_application(uuid,text) from public, anon;
grant execute on function public.lm_submit_driver_application(text,text,text,text,text,text,text,text,integer,text,text,text) to authenticated;
grant execute on function public.lm_review_driver_application(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.lm_approve_driver_application(uuid,text) to authenticated;
