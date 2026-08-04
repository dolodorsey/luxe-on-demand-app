const LUXE_APPROVED_SUPABASE_URL = 'https://dzlmtvodpyhetvektfuo.supabase.co'
const LUXE_APPROVED_PUBLISHABLE_KEY = 'sb_publishable_ekvoOK6QQ05dUZuWgzQfUw_2RgbWPFR'
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
    response.status(405).json({
      status: 'error',
      app: 'luxe-on-demand',
      error: 'Method not allowed',
    })
    return
  }

  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)

  try {
    const readinessResponse = await fetch(
      `${LUXE_APPROVED_SUPABASE_URL}/rest/v1/rpc/luxe_get_public_readiness_snapshot`,
      {
        method: 'POST',
        headers: {
          apikey: LUXE_APPROVED_PUBLISHABLE_KEY,
          Authorization: `Bearer ${LUXE_APPROVED_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal: controller.signal,
      },
    )

    const latencyMs = Date.now() - startedAt

    if (!readinessResponse.ok) {
      const detail = (await readinessResponse.text()).slice(0, 200)
      response.status(503).json({
        status: 'degraded',
        app: 'luxe-on-demand',
        brand: 'LUXE ON DEMAND',
        checked_at: new Date().toISOString(),
        latency_ms: latencyMs,
        checks: {
          application: 'reachable',
          database: 'unavailable',
          readiness_rpc: 'failed',
        },
        error: `Readiness RPC returned HTTP ${readinessResponse.status}`,
        detail,
      })
      return
    }

    if (method === 'HEAD') {
      response.status(200).end()
      return
    }

    const readiness = await readinessResponse.json()
    response.status(200).json({
      status: 'ok',
      app: 'luxe-on-demand',
      brand: 'LUXE ON DEMAND',
      checked_at: new Date().toISOString(),
      latency_ms: latencyMs,
      checks: {
        application: 'reachable',
        database: 'reachable',
        readiness_rpc: 'reachable',
      },
      readiness,
    })
  } catch (error) {
    response.status(503).json({
      status: 'degraded',
      app: 'luxe-on-demand',
      brand: 'LUXE ON DEMAND',
      checked_at: new Date().toISOString(),
      latency_ms: Date.now() - startedAt,
      checks: {
        application: 'reachable',
        database: 'unavailable',
        readiness_rpc: 'unavailable',
      },
      error: error instanceof Error ? error.message : 'Unknown health-check failure',
    })
  } finally {
    clearTimeout(timeout)
  }
}
