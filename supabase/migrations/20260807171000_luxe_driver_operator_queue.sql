create or replace function public.lm_operator_driver_applications(p_status text default null)
returns setof public.lm_driver_applications
language plpgsql
stable
security definer
set search_path='pg_catalog','public'
as $$
begin
  if not public.lm_is_operator() then raise exception 'LUXE operator access required' using errcode='42501'; end if;
  return query
    select * from public.lm_driver_applications
    where p_status is null or application_status=p_status
    order by submitted_at asc;
end;
$$;

revoke all on function public.lm_operator_driver_applications(text) from public,anon;
grant execute on function public.lm_operator_driver_applications(text) to authenticated;
