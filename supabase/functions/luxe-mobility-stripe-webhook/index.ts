import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})
const capturedOrLater = (status: string) => ['captured', 'transfer_pending', 'released', 'partially_refunded', 'refunded', 'disputed'].includes(status)
const LEGACY_VERIFIER = 'https://dzlmtvodpyhetvektfuo.supabase.co/functions/v1/luxe-stripe-signature-verify'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const url = Deno.env.get('SUPABASE_URL') || ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !service) return new Response('LUXE webhook database runtime is not configured', { status: 503 })

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  const readSecret = async (name: string) => {
    const direct = Deno.env.get(name)?.trim()
    if (direct) return direct
    const { data, error } = await admin.rpc('lm_get_runtime_secret', { p_key: name })
    return error || typeof data !== 'string' ? '' : data.trim()
  }
  const stripeKey = (await readSecret('LUXE_MOBILITY_STRIPE_SECRET_KEY')) || (await readSecret('STRIPE_SECRET_KEY'))
  const stripe = new Stripe(stripeKey || 'sk_test_webhook_verification_only', { httpClient: Stripe.createFetchHttpClient() })
  const raw = await req.text()
  const sig = req.headers.get('stripe-signature') || ''
  let event: Stripe.Event | null = null
  let signatureScope = 'legacy_verified'

  const [platformSecret, connectSecret] = await Promise.all([
    readSecret('LUXE_MOBILITY_STRIPE_WEBHOOK_SECRET'),
    readSecret('LUXE_MOBILITY_CONNECT_WEBHOOK_SECRET'),
  ])
  for (const [scope, secret] of [['platform', platformSecret], ['connect', connectSecret]] as const) {
    if (!secret) continue
    try {
      event = await stripe.webhooks.constructEventAsync(raw, sig, secret)
      signatureScope = scope
      break
    } catch {}
  }
  if (!event) {
    try {
      const verify = await fetch(LEGACY_VERIFIER, {
        method: 'POST',
        headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
        body: raw,
        signal: AbortSignal.timeout(4500),
      })
      if (!verify.ok) return new Response('Invalid signature', { status: 400 })
      event = JSON.parse(raw) as Stripe.Event
    } catch {
      return new Response('Webhook signature verification unavailable', { status: 503 })
    }
  }

  const object = event.data.object as any
  const intentId = object?.object === 'payment_intent'
    ? String(object.id || '')
    : typeof object?.payment_intent === 'string'
      ? object.payment_intent
      : object?.payment_intent?.id ? String(object.payment_intent.id) : ''
  const chargeId = object?.object === 'charge'
    ? String(object.id || '')
    : typeof object?.latest_charge === 'string' ? object.latest_charge : ''
  const accountId = event.type === 'account.updated' ? String(object?.id || '') : ''
  const rideId = String(object?.metadata?.ride_id || '')
  const luxeMetadata = object?.metadata?.app === 'luxe_mobility' || object?.metadata?.brand === 'LUXE'

  let payment: any = null
  if (intentId) {
    const { data } = await admin.from('lm_payments')
      .select('*,driver:lm_drivers!lm_payments_driver_id_fkey(stripe_account_id,payouts_enabled)')
      .eq('stripe_payment_intent_id', intentId).maybeSingle()
    payment = data
  }
  if (!payment && rideId) {
    const { data } = await admin.from('lm_payments')
      .select('*,driver:lm_drivers!lm_payments_driver_id_fkey(stripe_account_id,payouts_enabled)')
      .eq('ride_id', rideId).maybeSingle()
    payment = data
  }
  if (!payment && chargeId) {
    const { data } = await admin.from('lm_payments')
      .select('*,driver:lm_drivers!lm_payments_driver_id_fkey(stripe_account_id,payouts_enabled)')
      .eq('stripe_charge_id', chargeId).maybeSingle()
    payment = data
  }
  let driver: any = null
  if (accountId) {
    const { data } = await admin.from('lm_drivers').select('id,stripe_account_id,payouts_enabled').eq('stripe_account_id', accountId).maybeSingle()
    driver = data
  }

  if (!luxeMetadata && !payment && !driver) {
    return json({ received: true, ignored: true, reason: 'not_luxe_mobility', signature_scope: signatureScope })
  }

  const { error: eventError } = await admin.from('lm_payment_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payment_id: payment?.id ?? null,
    ride_id: payment?.ride_id ?? (rideId || null),
    livemode: event.livemode,
    payload: { id: event.id, type: event.type, created: event.created, signature_scope: signatureScope },
  })
  const duplicate = eventError?.code === '23505'
  if (eventError && !duplicate) return new Response('LUXE event ledger unavailable', { status: 500 })
  if (duplicate) return json({ received: true, duplicate: true, brand: 'LUXE' })

  if (event.type === 'account.updated' && accountId) {
    if (driver) {
      await admin.from('lm_drivers').update({
        payouts_enabled: Boolean(object.payouts_enabled && object.charges_enabled && object.details_submitted),
        updated_at: new Date().toISOString(),
      }).eq('id', driver.id)
    }
    return json({ received: true, brand: 'LUXE', account_sync: Boolean(driver), payouts_enabled: Boolean(object.payouts_enabled) })
  }
  if (!payment) return json({ received: true, brand: 'LUXE', reconciled: false })

  const now = new Date().toISOString()
  if (event.type === 'payment_intent.amount_capturable_updated') {
    const patch: any = {
      authorized_at: payment.authorized_at ?? now,
      stripe_payment_intent_id: object.id,
      stripe_charge_id: typeof object.latest_charge === 'string' ? object.latest_charge : object.latest_charge?.id ?? payment.stripe_charge_id,
      updated_at: now,
    }
    if (!capturedOrLater(String(payment.status || ''))) patch.status = 'authorized'
    await admin.from('lm_payments').update(patch).eq('id', payment.id)
  } else if (event.type === 'payment_intent.payment_failed') {
    if (!capturedOrLater(String(payment.status || ''))) {
      await admin.from('lm_payments').update({
        status: 'failed',
        failure_code: object.last_payment_error?.code ?? null,
        failure_message: object.last_payment_error?.message ?? null,
        updated_at: now,
      }).eq('id', payment.id)
    }
  } else if (event.type === 'payment_intent.canceled') {
    if (!capturedOrLater(String(payment.status || ''))) {
      await admin.from('lm_payments').update({ status: 'canceled', updated_at: now }).eq('id', payment.id)
    }
  } else if (event.type === 'payment_intent.succeeded') {
    const captured = Number(object.amount_received ?? object.amount ?? payment.amount_authorized ?? 0)
    const latestCharge = typeof object.latest_charge === 'string' ? object.latest_charge : object.latest_charge?.id ?? payment.stripe_charge_id
    await admin.from('lm_payments').update({
      status: payment.stripe_transfer_id ? 'released' : 'captured',
      amount_captured: captured,
      captured_at: payment.captured_at ?? now,
      stripe_charge_id: latestCharge,
      updated_at: now,
    }).eq('id', payment.id)

    if (!payment.stripe_transfer_id) {
      const { data: feeBps } = await admin.rpc('lm_get_runtime_integer', { p_key: 'platform_fee_bps' })
      const bps = feeBps === null || feeBps === undefined ? null : Number(feeBps)
      if (bps === null || !Number.isFinite(bps)) {
        return json({ received: true, brand: 'LUXE', captured: true, settlement_ready: false, reason: 'platform_fee_unconfigured' })
      }
      let payoutDriver = payment.driver
      if (!payoutDriver && payment.driver_id) {
        const { data } = await admin.from('lm_drivers').select('stripe_account_id,payouts_enabled').eq('id', payment.driver_id).maybeSingle()
        payoutDriver = data
      }
      const platformFee = Math.round(captured * bps / 10000)
      const driverPayout = Math.max(0, captured - platformFee)
      await admin.from('lm_payments').update({
        platform_fee_bps: bps,
        platform_fee_amount: platformFee,
        driver_payout_amount: driverPayout,
        status: 'transfer_pending',
        updated_at: now,
      }).eq('id', payment.id)

      if (!stripeKey || !payoutDriver?.stripe_account_id || !payoutDriver?.payouts_enabled) {
        return json({
          received: true,
          brand: 'LUXE',
          captured: true,
          settlement_ready: false,
          reason: !stripeKey ? 'stripe_api_unavailable' : !payoutDriver?.stripe_account_id ? 'driver_connect_missing' : 'driver_payouts_disabled',
        })
      }
      if (driverPayout > 0) {
        try {
          const transfer = await stripe.transfers.create({
            amount: driverPayout,
            currency: String(payment.currency || 'usd'),
            destination: payoutDriver.stripe_account_id,
            transfer_group: `luxe_ride_${payment.ride_id}`,
            metadata: { app: 'luxe_mobility', brand: 'LUXE', ride_id: String(payment.ride_id), payment_id: String(payment.id) },
          }, { idempotencyKey: `luxe-mobility-payment-${payment.id}-transfer-v1` })
          await admin.from('lm_payments').update({ status: 'released', stripe_transfer_id: transfer.id, released_at: now, updated_at: now }).eq('id', payment.id)
        } catch (error) {
          console.error('LUXE driver transfer failed', error)
          return new Response('LUXE driver transfer retry required', { status: 503 })
        }
      } else {
        await admin.from('lm_payments').update({ status: 'released', released_at: now, updated_at: now }).eq('id', payment.id)
      }
    }
  } else if (event.type === 'charge.refunded') {
    const refunded = Number(object.amount_refunded ?? 0)
    const captured = Number(payment.amount_captured ?? 0)
    const refundId = Array.isArray(object.refunds?.data) && object.refunds.data.length
      ? String(object.refunds.data[0]?.id || '')
      : payment.stripe_refund_id
    await admin.from('lm_payments').update({
      amount_refunded: refunded,
      status: captured > 0 && refunded >= captured ? 'refunded' : 'partially_refunded',
      stripe_refund_id: refundId || null,
      refunded_at: now,
      updated_at: now,
    }).eq('id', payment.id)
  } else if (event.type === 'charge.dispute.created') {
    await admin.from('lm_payments').update({
      status: 'disputed',
      stripe_dispute_id: String(object.dispute || object.id || ''),
      disputed_at: now,
      updated_at: now,
    }).eq('id', payment.id)
  }

  return json({ received: true, brand: 'LUXE', duplicate: false, reconciled: true, stripe_api_ready: Boolean(stripeKey) })
})
