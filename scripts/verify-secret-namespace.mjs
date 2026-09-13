import { readFileSync } from 'node:fs'

const files = [
  'supabase/functions/luxe-mobility-health/index.ts',
  'supabase/functions/luxe-mobility-route/index.ts',
  'supabase/functions/luxe-mobility-payments/index.ts',
  'supabase/functions/luxe-mobility-connect-onboarding/index.ts',
  'supabase/functions/luxe-mobility-stripe-webhook/index.ts',
]

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  if (source.includes('sos_get_runtime_secret')) {
    throw new Error(`${file} must not depend on the S.O.S. runtime secret resolver`)
  }
  if (!source.includes('lm_get_runtime_secret')) {
    throw new Error(`${file} must resolve private runtime configuration through the LUXE namespace`)
  }
}

const migration = readFileSync('supabase/migrations/20260912054500_luxe_mobility_runtime_secret_resolver.sql', 'utf8')
for (const token of [
  'create or replace function public.lm_get_runtime_secret',
  'security definer',
  'revoke all on function public.lm_get_runtime_secret(text) from public, anon, authenticated',
  'grant execute on function public.lm_get_runtime_secret(text) to service_role',
]) {
  if (!migration.toLowerCase().includes(token.toLowerCase())) {
    throw new Error(`LUXE runtime secret migration is missing: ${token}`)
  }
}

console.log('LUXE runtime secret namespace isolation verified')
