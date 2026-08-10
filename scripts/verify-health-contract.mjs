import { readFileSync } from 'node:fs'

const route = readFileSync('api/health.js', 'utf8')
const edge = readFileSync('supabase/functions/luxe-mobility-health/index.ts', 'utf8')

const requiredRouteTokens = [
  "app: 'luxe-mobility'",
  "brand: 'LUXE ON DEMAND'",
  "status: 'degraded'",
  'launch_ready: false',
  'luxe-mobility-health',
  "'Cache-Control', 'no-store, max-age=0'",
  'HEALTH_TIMEOUT_MS',
  "['GET', 'HEAD']",
  'module.exports = async function handler',
  'https://cxdqkjvtpilvouwtbgdy.supabase.co',
]

for (const token of requiredRouteTokens) {
  if (!route.includes(token)) {
    throw new Error(`Health route is missing required mobility contract token: ${token}`)
  }
}

const forbiddenRouteTokens = [
  'dzlmtvodpyhetvektfuo',
  'luxe_get_public_readiness_snapshot',
  'White-Glove Beauty Marketplace',
  'cs_rpc_active_marketplace_readiness',
]
for (const token of forbiddenRouteTokens) {
  if (route.includes(token)) {
    throw new Error(`Health route still contains obsolete beauty/Gateway binding: ${token}`)
  }
}

if (/service[_-]?role|sb_secret_/i.test(route)) {
  throw new Error('Public health route must never embed a Supabase secret or service-role credential')
}

const requiredEdgeTokens = [
  "app:'LUXE Mobility'",
  "project_ref:'cxdqkjvtpilvouwtbgdy'",
  "admin.from('lm_vehicle_classes')",
  "admin.from('lm_drivers')",
  "approval_status','approved'",
  "payouts_enabled',true",
  "on_duty',true",
  "GOOGLE_MAPS_ROUTES_API_KEY",
  "LUXE_MOBILITY_STRIPE_SECRET_KEY",
  "LUXE_MOBILITY_STRIPE_WEBHOOK_SECRET",
  'launch_ready:launchReady',
  "blockers.push('routing_provider')",
  "blockers.push('stripe_webhook')",
]
for (const token of requiredEdgeTokens) {
  if (!edge.includes(token)) {
    throw new Error(`Mobility health Edge Function is missing required token: ${token}`)
  }
}

const forbiddenEdgeTokens = ['cs_', 'stylist', 'beauty marketplace', 'dzlmtvodpyhetvektfuo']
for (const token of forbiddenEdgeTokens) {
  if (edge.toLowerCase().includes(token.toLowerCase())) {
    throw new Error(`Mobility health Edge Function contains obsolete product/backend token: ${token}`)
  }
}

console.log('LUXE mobility health contract verified')
