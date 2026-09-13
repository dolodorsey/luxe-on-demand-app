create or replace function public.lm_get_runtime_secret(p_key text)
returns text
language sql
stable
security definer
set search_path = vault, pg_temp
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_key
  limit 1;
$$;

revoke all on function public.lm_get_runtime_secret(text) from public, anon, authenticated;
grant execute on function public.lm_get_runtime_secret(text) to service_role;
