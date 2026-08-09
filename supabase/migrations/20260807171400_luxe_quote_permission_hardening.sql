revoke all on function public.lm_quote_fare(text,numeric,integer) from public,anon;
grant execute on function public.lm_quote_fare(text,numeric,integer) to authenticated;
