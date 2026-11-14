-- Reject withdrawn applications before profile, driver or review writes.
CREATE OR REPLACE FUNCTION public.lm_approve_driver_application(p_application_id uuid, p_review_note text DEFAULT NULL::text)
 RETURNS lm_drivers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare a public.lm_driver_applications%rowtype; p public.lm_profiles%rowtype; d public.lm_drivers%rowtype;
begin
  if not public.lm_is_operator() then raise exception 'LUXE operator access required' using errcode='42501'; end if;
  select * into a from public.lm_driver_applications where id=p_application_id for update;
  if not found then raise exception 'Driver application not found'; end if;
  if a.application_status='withdrawn' then raise exception 'Withdrawn application must be returned to review before approval'; end if;
  if a.application_status='rejected' then raise exception 'Rejected application must be returned to review before approval'; end if;
  if a.driver_license_status<>'verified' or a.insurance_status<>'verified' or a.background_status<>'verified' or a.vehicle_status<>'verified' then raise exception 'All driver, insurance, background, and vehicle checks must be verified before approval'; end if;
  insert into public.lm_profiles(auth_id,role,full_name,phone,status) values(a.auth_id,'driver',a.full_name,a.phone,'active') on conflict(auth_id) do update set role='driver',full_name=excluded.full_name,phone=excluded.phone,status='active',updated_at=now() returning * into p;
  insert into public.lm_drivers(profile_id,approval_status,on_duty,vehicle_class_id,vehicle_make,vehicle_model,vehicle_color,vehicle_plate,payouts_enabled)
  values(p.id,'approved',false,a.vehicle_class_id,a.vehicle_make,a.vehicle_model,a.vehicle_color,a.vehicle_plate,false)
  on conflict(profile_id) do update set approval_status='approved',on_duty=false,vehicle_class_id=excluded.vehicle_class_id,vehicle_make=excluded.vehicle_make,vehicle_model=excluded.vehicle_model,vehicle_color=excluded.vehicle_color,vehicle_plate=excluded.vehicle_plate,payouts_enabled=false,updated_at=now() returning * into d;
  update public.lm_driver_applications set application_status='approved',review_note=left(nullif(trim(p_review_note),''),2000),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=a.id;
  return d;
end;$function$;
