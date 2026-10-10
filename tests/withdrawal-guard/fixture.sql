create schema auth; create function auth.uid() returns uuid language sql as $$select '00000000-0000-4000-8000-00000000c032'::uuid$$; create function public.lm_is_operator() returns boolean language sql as $$select true$$;
create table lm_vehicle_classes(id text primary key); insert into lm_vehicle_classes values('qa-class');
create table lm_profiles (id uuid default gen_random_uuid() not null,auth_id uuid not null,role text default 'rider'::text not null,full_name text not null,phone text,status text default 'active'::text not null,created_at timestamptz default now() not null,updated_at timestamptz default now() not null);
create table lm_drivers (id uuid default gen_random_uuid() not null,profile_id uuid not null,approval_status text default 'pending'::text not null,on_duty bool default false not null,vehicle_class_id text,vehicle_make text,vehicle_model text,vehicle_color text,vehicle_plate text,latitude float8,longitude float8,last_location_at timestamptz,rating numeric default 5.00 not null,completed_rides int4 default 0 not null,stripe_account_id text,payouts_enabled bool default false not null,created_at timestamptz default now() not null,updated_at timestamptz default now() not null);
create table lm_driver_applications (id uuid default gen_random_uuid() not null,auth_id uuid not null,full_name text not null,email text,phone text,city text not null,state_code text not null,vehicle_class_id text not null,vehicle_make text not null,vehicle_model text not null,vehicle_year int4 not null,vehicle_color text not null,vehicle_plate text not null,driver_license_status text default 'pending'::text not null,insurance_status text default 'pending'::text not null,background_status text default 'pending'::text not null,vehicle_status text default 'pending'::text not null,application_status text default 'submitted'::text not null,applicant_note text,review_note text,submitted_at timestamptz default now() not null,reviewed_at timestamptz,reviewed_by uuid,created_at timestamptz default now() not null,updated_at timestamptz default now() not null);
alter table lm_profiles add constraint lm_profiles_auth_id_key UNIQUE (auth_id);
alter table lm_profiles add constraint lm_profiles_pkey PRIMARY KEY (id);
alter table lm_profiles add constraint lm_profiles_role_check CHECK ((role = ANY (ARRAY['rider'::text, 'driver'::text, 'admin'::text])));
alter table lm_profiles add constraint lm_profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'closed'::text])));
alter table lm_drivers add constraint lm_drivers_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'suspended'::text, 'rejected'::text])));
alter table lm_drivers add constraint lm_drivers_pkey PRIMARY KEY (id);
alter table lm_drivers add constraint lm_drivers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES lm_profiles(id) ON DELETE CASCADE;
alter table lm_drivers add constraint lm_drivers_profile_id_key UNIQUE (profile_id);
alter table lm_drivers add constraint lm_drivers_vehicle_class_id_fkey FOREIGN KEY (vehicle_class_id) REFERENCES lm_vehicle_classes(id);
alter table lm_driver_applications add constraint lm_driver_applications_application_status_check CHECK ((application_status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'withdrawn'::text])));
alter table lm_driver_applications add constraint lm_driver_applications_auth_id_key UNIQUE (auth_id);
alter table lm_driver_applications add constraint lm_driver_applications_background_status_check CHECK ((background_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])));
alter table lm_driver_applications add constraint lm_driver_applications_driver_license_status_check CHECK ((driver_license_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])));
alter table lm_driver_applications add constraint lm_driver_applications_insurance_status_check CHECK ((insurance_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])));
alter table lm_driver_applications add constraint lm_driver_applications_pkey PRIMARY KEY (id);
alter table lm_driver_applications add constraint lm_driver_applications_vehicle_class_id_fkey FOREIGN KEY (vehicle_class_id) REFERENCES lm_vehicle_classes(id);
alter table lm_driver_applications add constraint lm_driver_applications_vehicle_status_check CHECK ((vehicle_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])));
alter table lm_driver_applications add constraint lm_driver_applications_vehicle_year_check CHECK (((vehicle_year >= 1990) AND (vehicle_year <= 2100)));
CREATE OR REPLACE FUNCTION public.lm_review_driver_application(p_application_id uuid, p_driver_license_status text, p_insurance_status text, p_background_status text, p_vehicle_status text, p_decision text DEFAULT 'under_review'::text, p_review_note text DEFAULT NULL::text)
 RETURNS lm_driver_applications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v public.lm_driver_applications%rowtype;
begin
  if not public.lm_is_operator() then raise exception 'LUXE operator access required' using errcode='42501'; end if;
  if p_driver_license_status not in ('pending','verified','rejected') or p_insurance_status not in ('pending','verified','rejected') or p_background_status not in ('pending','verified','rejected') or p_vehicle_status not in ('pending','verified','rejected') then raise exception 'Invalid verification status'; end if;
  if p_decision not in ('under_review','rejected') then raise exception 'Review decision must be under_review or rejected'; end if;
  update public.lm_driver_applications set driver_license_status=p_driver_license_status,insurance_status=p_insurance_status,background_status=p_background_status,vehicle_status=p_vehicle_status,application_status=p_decision,review_note=left(nullif(trim(p_review_note),''),2000),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=p_application_id and application_status<>'approved' returning * into v;
  if not found then raise exception 'Driver application not found or already approved'; end if;
  return v;
end;$function$
