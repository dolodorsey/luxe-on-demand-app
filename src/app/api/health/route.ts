import { NextResponse } from 'next/server'

import {
  LUXE_APPROVED_PUBLISHABLE_KEY,
  LUXE_APPROVED_SUPABASE_URL,
} from '../../../config/luxe-public-backend'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const HEALTH_TIMEOUT_MS = 5_000

function responseHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  }
}

export async function GET() {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)

  try {
    const response = await fetch(
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

    if (!response.ok) {
      const errorBody = await response.text()
      return NextResponse.json(
        {
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
          error: `Readiness RPC returned HTTP ${response.status}`,
          detail: errorBody.slice(0, 200),
        },
        { status: 503, headers: responseHeaders() },
      )
    }

    const readiness = (await response.json()) as Record<string, unknown>

    return NextResponse.json(
      {
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
      },
      { status: 200, headers: responseHeaders() },
    )
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    const message = error instanceof Error ? error.message : 'Unknown health-check failure'

    return NextResponse.json(
      {
        status: 'degraded',
        app: 'luxe-on-demand',
        brand: 'LUXE ON DEMAND',
        checked_at: new Date().toISOString(),
        latency_ms: latencyMs,
        checks: {
          application: 'reachable',
          database: 'unavailable',
          readiness_rpc: 'unavailable',
        },
        error: message,
      },
      { status: 503, headers: responseHeaders() },
    )
  } finally {
    clearTimeout(timeout)
  }
}
