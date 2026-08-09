import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  const url=Deno.env.get('SUPABASE_URL')
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeSecret=Deno.env.get('LUXE_MOBILITY_STRIPE_SECRET_KEY')
  const webhookSecret=Deno.env.get('LUXE_MOBILITY_STRIPE_WEBHOOK_SECRET')
  if(!url||!serviceRole||!stripeSecret||!webhookSecret)return json({error:'Webhook is not configured.'},503)

  const signature=req.headers.get('Stripe-Signature')
  if(!signature)return json({error:'Missing Stripe signature.'},400)
  const rawBody=await req.text()
  const stripe=new Stripe(stripeSecret,{httpClient:Stripe.createFetchHttpClient()})
  let event:Stripe.Event
  try{
    event=await stripe.webhooks.constructEventAsync(rawBody,signature,webhookSecret,undefined,Stripe.createSubtleCryptoProvider())
  }catch{
    return json({error:'Invalid Stripe signature.'},400)
  }

  const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const object=event.data.object as Stripe.PaymentIntent
  const rideId=object.metadata?.ride_id
  if(!rideId)return json({received:true,ignored:true})

  if(event.type==='payment_intent.amount_capturable_updated'){
    await admin.from('lm_payments').update({
      status:'authorized',amount_authorized:object.amount,authorized_at:new Date().toISOString(),updated_at:new Date().toISOString(),
    }).eq('stripe_payment_intent_id',object.id)
  }else if(event.type==='payment_intent.succeeded'){
    await admin.from('lm_payments').update({
      status:'captured',amount_captured:object.amount_received,captured_at:new Date().toISOString(),updated_at:new Date().toISOString(),
    }).eq('stripe_payment_intent_id',object.id)
  }else if(event.type==='payment_intent.payment_failed'){
    await admin.from('lm_payments').update({status:'failed',updated_at:new Date().toISOString()}).eq('stripe_payment_intent_id',object.id)
  }else if(event.type==='payment_intent.canceled'){
    await admin.from('lm_payments').update({status:'canceled',updated_at:new Date().toISOString()}).eq('stripe_payment_intent_id',object.id)
  }

  return json({received:true})
})
