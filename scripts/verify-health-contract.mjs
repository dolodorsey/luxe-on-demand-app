import { readFileSync } from 'node:fs'

const route = readFileSync('api/health.js', 'utf8')
const migration = readFileSync(
  'supabase/migrations/20260804133500_luxe_public_readiness_health.sql',
  'utf8',
)

const requiredRouteTokens = [
  "app: 'luxe-on-demand'",
  "status: 'ok'",
  "status: 'degraded'",
  'luxe_get_public_readiness_snapshot',
  "'Cache-Control', 'no-store, max-age=0'",
  'HEALTH_TIMEOUT_MS',
  "['GET', 'HEAD']",
  'module.exports = async function handler',
  "https://dzlmtvodpyhetvektfuo.supabase.co",
]

for (const token of requiredRouteTokens) {
  if (!route.includes(token)) {
    throw new Error(`Health function is missing required contract token: ${token}`)
  }
}

if (/service[_-]?role|sb_secret_/i.test(route)) {
  throw new Error('Health function must never use a Supabase secret or service-role credential')
}

if (!/sb_publishable_[A-Za-z0-9_-]{20,}/.test(route)) {
  throw new Error('Health function is missing the approved public Supabase binding')
}

const requiredMigrationTokens = [
  'create or replace function public.luxe_get_public_readiness_snapshot()',
  "'launch_ready'",
  "'supply_readiness_pct'",
  "'live_dispatch_readiness_pct'",
  'grant execute on function public.luxe_get_public_readiness_snapshot() to anon,authenticated,service_role',
]

for (const token of requiredMigrationTokens) {
  if (!migration.includes(token)) {
    throw new Error(`Readiness migration is missing required contract token: ${token}`)
  }
}

if (/\b(phone|email|instagram|website|business_name)\b/.test(migration)) {
  throw new Error('Public readiness migration must not expose candidate contact or business records')
}

console.log('LUXE health contract verified')
