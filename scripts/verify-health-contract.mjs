import { readFileSync } from 'node:fs'

const route = readFileSync('api/health.js', 'utf8')
const edge = readFileSync('supabase/functions/luxe-mobility-health/index.ts', 'utf8')
const routing = readFileSync('supabase/functions/luxe-mobility-route/index.ts', 'utf8')

const requiredRouteTokens = [
  "app: 'luxe-mobility'",
  "brand: 'LUXE ON DEMAND'",
  "status: 'degraded'",
  'service_ready: false',
  'launch_ready: false',
  'luxe-mobility-health',
  "'Cache-Control', 'no-store, max-age=0'",
  'HEALTH_TIMEOUT_MS',
  "['GET', 'HEAD']",
  'module.exports = async function handler',
  'https://cxdqkjvtpilvouwtbgdy.supabase.co',
  "routing: payload.routing_provider_configured ? 'configured' : 'blocked'",
  "stripe_api: payload.stripe_api_reachable ? 'reachable' : 'blocked'",
  "stripe_payment_webhook: payload.stripe_payment_webhook_ready ? 'ready' : 'blocked'",
  "stripe_connect_webhook: payload.stripe_connect_webhook_ready ? 'ready' : 'blocked'",
  "settlement_fee: payload.platform_fee_configured ? 'configured' : 'blocked'",
  "driver_supply: Number(payload.on_duty_drivers || 0) > 0 ? 'ready' : 'blocked'",
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
  "admin.from('lm_driver_applications')",
  "admin.from('lm_drivers')",
  "admin.from('lm_rides')",
  "admin.from('lm_payments')",
  "approval_status','approved'",
  "payouts_enabled',true",
  "on_duty',true",
  "lm_get_runtime_secret",
  "lm_get_runtime_integer",
  "GOOGLE_MAPS_ROUTES_API_KEY",
  "LUXE_MOBILITY_STRIPE_SECRET_KEY",
  "https://api.stripe.com",
  "/v1/balance",
  "/v1/webhook_endpoints?limit=100",
  "luxe-mobility-stripe-webhook",
  'service_ready:serviceReady',
  'launch_ready:launchReady',
  "blockers.push('routing_provider')",
  "blockers.push('settlement_fee')",
  "blockers.push('stripe_server_reachability')",
  "blockers.push('stripe_payment_webhook')",
  "blockers.push('stripe_connect_webhook')",
]
for (const token of requiredEdgeTokens) {
  if (!edge.includes(token)) {
    throw new Error(`Mobility health Edge Function is missing required token: ${token}`)
  }
}

const forbiddenEdgeTokens = ['cs_', 'stylist', 'beauty marketplace', 'dzlmtvodpyhetvektfuo', 'sos_get_runtime_secret', 'LUXE_MOBILITY_STRIPE_WEBHOOK_SECRET']
for (const token of forbiddenEdgeTokens) {
  if (edge.toLowerCase().includes(token.toLowerCase())) {
    throw new Error(`Mobility health Edge Function contains obsolete product/backend token: ${token}`)
  }
}

const requiredRoutingTokens = [
  'GOOGLE_MAPS_ROUTES_API_KEY',
  'lm_get_runtime_secret',
  'ROUTING_TIMEOUT_MS',
  'routing_provider_unconfigured',
  'routing_timeout',
  'google-routes-v2',
]
for (const token of requiredRoutingTokens) {
  if (!routing.includes(token)) {
    throw new Error(`Mobility routing Edge Function is missing required token: ${token}`)
  }
}
if (routing.includes('sos_get_runtime_secret')) {
  throw new Error('LUXE routing must not depend on the S.O.S. runtime secret resolver')
}

console.log('LUXE mobility health contract verified')
