-- Fail closed on lifecycle conflicts and make an already completed approval a
-- true no-op. Reinstatement and changes to an existing approved driver require
-- separate, explicitly authorized workflows.
CREATE OR REPLACE FUNCTION public.lm_approve_driver_application(p_application_id uuid, p_review_note text DEFAULT NULL::text)
 RETURNS lm_drivers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  a public.lm_driver_applications%rowtype;
  p public.lm_profiles%rowtype;
  d public.lm_drivers%rowtype;
begin
  if not public.lm_is_operator() then raise exception 'LUXE operator access required' using errcode='42501'; end if;

  select * into a from public.lm_driver_applications where id=p_application_id for update;
  if not found then raise exception 'Driver application not found'; end if;
  if a.application_status='withdrawn' then raise exception 'Withdrawn application must be returned to review before approval'; end if;
  if a.application_status='rejected' then raise exception 'Rejected application must be returned to review before approval'; end if;
  if a.driver_license_status<>'verified' or a.insurance_status<>'verified' or a.background_status<>'verified' or a.vehicle_status<>'verified' then
    raise exception 'All driver, insurance, background, and vehicle checks must be verified before approval';
  end if;

  select * into p from public.lm_profiles where auth_id=a.auth_id for update;
  if found then
    if p.role not in ('rider','driver') then raise exception 'Existing account role requires separate review before driver approval'; end if;
    if p.status<>'active' then raise exception 'Existing account is not active; separate reinstatement review is required'; end if;
  elsif a.application_status='approved' then
    raise exception 'Approved application has no active driver profile; manual reconciliation is required';
  else
    insert into public.lm_profiles(auth_id,role,full_name,phone,status)
    values(a.auth_id,'driver',a.full_name,a.phone,'active') returning * into p;
  end if;

  select * into d from public.lm_drivers where profile_id=p.id for update;
  if found then
    if a.application_status='approved' and p.role='driver' and p.status='active' and d.approval_status='approved' then
      return d;
    end if;
    if a.application_status='approved' then raise exception 'Approved application and driver state disagree; manual reconciliation is required'; end if;
    if d.approval_status<>'pending' then raise exception 'Existing driver requires separate reinstatement review before approval'; end if;
  elsif a.application_status='approved' then
    raise exception 'Approved application has no driver record; manual reconciliation is required';
  end if;

  if p.role='rider' then
    update public.lm_profiles set role='driver',updated_at=now() where id=p.id returning * into p;
  end if;

  if d.id is null then
    insert into public.lm_drivers(profile_id,approval_status,on_duty,vehicle_class_id,vehicle_make,vehicle_model,vehicle_color,vehicle_plate,payouts_enabled)
    values(p.id,'approved',false,a.vehicle_class_id,a.vehicle_make,a.vehicle_model,a.vehicle_color,a.vehicle_plate,false)
    returning * into d;
  else
    update public.lm_drivers set approval_status='approved',on_duty=false,vehicle_class_id=a.vehicle_class_id,
      vehicle_make=a.vehicle_make,vehicle_model=a.vehicle_model,vehicle_color=a.vehicle_color,vehicle_plate=a.vehicle_plate,
      payouts_enabled=false,updated_at=now() where id=d.id returning * into d;
  end if;

  update public.lm_driver_applications set application_status='approved',review_note=left(nullif(trim(p_review_note),''),2000),
    reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=a.id;
  return d;
end;
$function$;
