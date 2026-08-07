create or replace function public.lm_driver_active_rides()
returns setof public.lm_rides
language sql
stable security definer
set search_path='pg_catalog','public'
as $$
  with me as (
    select d.id
    from public.lm_drivers d
    join public.lm_profiles p on p.id=d.profile_id
    where p.auth_id=auth.uid()
      and p.status='active'
      and d.approval_status='approved'
    limit 1
  )
  select r.*
  from public.lm_rides r
  join me on me.id=r.driver_id
  where r.status in('accepted','en_route','arrived','in_progress')
  order by r.created_at desc;
$$;
revoke all on function public.lm_driver_active_rides() from public,anon;
grant execute on function public.lm_driver_active_rides() to authenticated;
