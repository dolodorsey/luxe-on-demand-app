/**
 * LUXE PWA install-only public telemetry routes in canonical KOLLECTIVE BOH.
 * These public endpoints are separate from LUXE's mobility backend and
 * must never be used for ride/driver data or privileged API operations.
 * Source audit: 2026-10-24, refactored from InstallAppPrompt unchanged.
 */
const LUXE_PWA_BOH_PUBLIC_BASE = 'https://wfkohcwxxsrhcxhepfql.supabase.co/functions/v1'

export const LUXE_INSTALL_QR_ENDPOINT = `${LUXE_PWA_BOH_PUBLIC_BASE}/app-install-qr`
export const LUXE_PWA_EVENT_CAPTURE_ENDPOINT = `${LUXE_PWA_BOH_PUBLIC_BASE}/marketing-event-capture`
