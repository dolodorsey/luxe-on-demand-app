-- Ensures ON CONFLICT (auth_id) can safely resolve the LUXE profile upsert.
-- PostgreSQL permits multiple NULL values in a normal unique index, so a
-- partial index is not required.

begin;

drop index if exists public.cs_users_auth_id_uidx;
create unique index cs_users_auth_id_uidx on public.cs_users(auth_id);

commit;
