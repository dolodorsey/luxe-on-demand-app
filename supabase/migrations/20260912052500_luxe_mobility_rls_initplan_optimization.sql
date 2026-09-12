alter policy lm_driver_applications_own_read
  on public.lm_driver_applications
  using (auth_id = (select auth.uid()));

alter policy lm_profiles_own_read
  on public.lm_profiles
  using (auth_id = (select auth.uid()));

alter policy lm_payments_rider_read
  on public.lm_payments
  using (
    rider_profile_id in (
      select id from public.lm_profiles where auth_id = (select auth.uid())
    )
  );

alter policy lm_ratings_rider_read
  on public.lm_ratings
  using (
    rider_profile_id in (
      select id from public.lm_profiles where auth_id = (select auth.uid())
    )
  );

alter policy lm_rides_participant_read
  on public.lm_rides
  using (
    rider_profile_id in (
      select id from public.lm_profiles where auth_id = (select auth.uid())
    )
    or driver_id in (
      select d.id
      from public.lm_drivers d
      join public.lm_profiles p on p.id = d.profile_id
      where p.auth_id = (select auth.uid())
    )
  );
