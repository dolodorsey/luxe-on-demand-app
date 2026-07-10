-- LUXE booking lifecycle write lockdown
-- Apply after the security and dispatch migrations.

begin;

-- Clients can still create bookings. All lifecycle changes, assignment,
-- cancellation and completion must go through the reviewed RPCs.
revoke update on public.cs_bookings from anon, authenticated;
revoke insert, update, delete on public.cs_booking_offers from anon, authenticated;
revoke insert, update, delete on public.cs_booking_events from anon, authenticated;

commit;
