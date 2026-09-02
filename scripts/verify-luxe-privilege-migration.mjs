import fs from 'node:fs'

const migrationPath = 'supabase/migrations/20260902115001_luxe_mobility_browser_privilege_hardening.sql'
const sql = fs.readFileSync(migrationPath, 'utf8')
const executableSql = sql
  .replace(/--.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const required = [
  'revoke all privileges on table public.lm_vehicle_classes from anon, authenticated;',
  'revoke all privileges on table public.lm_driver_applications from anon, authenticated;',
  'revoke all privileges on table public.lm_ride_driver_public from anon, authenticated;',
  'grant select on table public.lm_vehicle_classes to anon, authenticated;',
  'grant select on table public.lm_profiles to authenticated;',
  'grant select on table public.lm_rides to authenticated;',
  'grant select on table public.lm_driver_applications to authenticated;',
  'grant select on table public.lm_ride_driver_public to authenticated;',
]

for (const statement of required) {
  if (!executableSql.includes(statement)) throw new Error(`Missing required LUXE privilege contract: ${statement}`)
}

const forbiddenNamespace = /\b(?:oc|sos|tempo|gt|cg|mission365|noir)_/i
if (forbiddenNamespace.test(executableSql)) throw new Error('LUXE privilege migration references another product namespace')

const destructiveData = /\b(?:delete\s+from|truncate\s+table|drop\s+table|drop\s+schema)\b/i
if (destructiveData.test(executableSql)) throw new Error('LUXE privilege migration contains a destructive data/schema operation')

const browserMutationGrant = /grant\s+(?:all|insert|update|delete|truncate|references|trigger)[^;]*\b(?:anon|authenticated)\b/i
if (browserMutationGrant.test(executableSql)) throw new Error('LUXE privilege migration grants a browser role mutation/destructive privilege')

console.log('LUXE mobility least-privilege migration contract: PASS')
