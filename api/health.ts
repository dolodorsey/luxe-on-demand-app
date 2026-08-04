import {
  LUXE_APPROVED_PUBLISHABLE_KEY,
  LUXE_APPROVED_SUPABASE_URL,
} from '../src/config/luxe-public-backend'

type HealthRequest = {
  method?: string
}

type HealthResponse = {
  setHeader(name: string, value: string): void
  status(code: number): HealthResponse
  json(body: unknown): void
  end(): void
}

const HEALTH_TIMEOUT_MS = 5_000

function configureHeaders(response: HealthResponse) {
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
}

export default async function handler(request: HealthRequest, response: HealthResponse) {
  configureHeaders(response)

  if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
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
        cache: 'no-store',
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

    const readiness = (await readinessResponse.json()) as Record<string, unknown>
    const body = {
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
    }

    if (request.method === 'HEAD') {
      response.status(200).end()
      return
    }

    response.status(200).json(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown health-check failure'
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
      error: message,
    })
  } finally {
    clearTimeout(timeout)
  }
}
