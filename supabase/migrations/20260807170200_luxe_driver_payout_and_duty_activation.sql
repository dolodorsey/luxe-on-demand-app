create or replace function public.lm_driver_status()
returns public.lm_drivers
language plpgsql
stable
security definer
set search_path='pg_catalog','public'
as $$
declare d public.lm_drivers%rowtype;
begin
  select d0.* into d from public.lm_drivers d0 join public.lm_profiles p on p.id=d0.profile_id
  where p.auth_id=auth.uid() and p.status='active' limit 1;
  if not found then raise exception 'LUXE driver profile required' using errcode='42501'; end if;
  return d;
end;
$$;

create or replace function public.lm_set_driver_duty(p_on_duty boolean)
returns public.lm_drivers
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare d public.lm_drivers%rowtype;
begin
  update public.lm_drivers d0 set on_duty=case when p_on_duty then true else false end,updated_at=now()
  from public.lm_profiles p
  where d0.profile_id=p.id and p.auth_id=auth.uid() and p.status='active' and d0.approval_status='approved'
    and (not p_on_duty or d0.payouts_enabled)
  returning d0.* into d;
  if not found then
    if p_on_duty then raise exception 'Approved driver with completed payout setup required before going online'; end if;
    raise exception 'Approved LUXE driver required' using errcode='42501';
  end if;
  return d;
end;
$$;

revoke all on function public.lm_driver_status() from public,anon;
revoke all on function public.lm_set_driver_duty(boolean) from public,anon;
grant execute on function public.lm_driver_status() to authenticated;
grant execute on function public.lm_set_driver_duty(boolean) to authenticated;
