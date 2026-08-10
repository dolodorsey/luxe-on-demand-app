const LUXE_MOBILITY_HEALTH_URL = 'https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/luxe-mobility-health'
const HEALTH_TIMEOUT_MS = 5_000

function configureHeaders(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
}

module.exports = async function handler(request, response) {
  configureHeaders(response)
  const method = request.method || 'GET'
  if (!['GET', 'HEAD'].includes(method)) {
    response.setHeader('Allow', 'GET, HEAD')
    response.status(405).json({ status: 'error', app: 'luxe-mobility', error: 'Method not allowed' })
    return
  }

  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
  try {
    const upstream = await fetch(LUXE_MOBILITY_HEALTH_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    const payload = await upstream.json().catch(() => null)
    if (!upstream.ok || !payload) {
      response.status(503).json({
        status: 'degraded', app: 'luxe-mobility', brand: 'LUXE ON DEMAND', checked_at: new Date().toISOString(),
        latency_ms: Date.now() - startedAt, launch_ready: false,
        checks: { application: 'reachable', mobility_backend: 'unavailable' },
        error: payload?.error || `Mobility health returned HTTP ${upstream.status}`,
      })
      return
    }
    if (method === 'HEAD') { response.status(200).end(); return }
    response.status(200).json({
      ...payload,
      app: 'luxe-mobility',
      brand: 'LUXE ON DEMAND',
      checked_at: new Date().toISOString(),
      proxy_latency_ms: Date.now() - startedAt,
      checks: { application: 'reachable', mobility_backend: 'reachable', database: payload.database },
    })
  } catch (error) {
    response.status(503).json({
      status: 'degraded', app: 'luxe-mobility', brand: 'LUXE ON DEMAND', checked_at: new Date().toISOString(),
      latency_ms: Date.now() - startedAt, launch_ready: false,
      checks: { application: 'reachable', mobility_backend: 'unavailable' },
      error: error instanceof Error ? error.message : 'Unknown mobility health failure',
    })
  } finally {
    clearTimeout(timeout)
  }
}
