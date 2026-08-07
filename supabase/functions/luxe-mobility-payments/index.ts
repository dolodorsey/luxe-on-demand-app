import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)

  const url=Deno.env.get('SUPABASE_URL')
  const anon=Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeSecret=Deno.env.get('LUXE_MOBILITY_STRIPE_SECRET_KEY') || Deno.env.get('STRIPE_SECRET_KEY')
  if(!url||!anon||!serviceRole)return json({error:'LUXE mobility backend is not configured.'},503)
  if(!stripeSecret)return json({error:'Shared ON CALL/LUXE Stripe runtime is not configured.'},503)

  const authorization=req.headers.get('Authorization')||''
  const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}})
  const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:{user},error:userError}=await userClient.auth.getUser()
  if(userError||!user)return json({error:'Authentication required.'},401)

  const payload=await req.json().catch(()=>({})) as {action?:string;rideId?:string}
  const action=String(payload.action||'')
  const rideId=String(payload.rideId||'')
  if(!rideId)return json({error:'rideId is required.'},400)

  const stripe=new Stripe(stripeSecret,{httpClient:Stripe.createFetchHttpClient()})
  const {data:profile}=await admin.from('lm_profiles').select('id,role').eq('auth_id',user.id).eq('status','active').maybeSingle()
  if(!profile)return json({error:'Active LUXE profile required.'},403)

  if(action==='authorize'){
    const {data:ride}=await admin.from('lm_rides').select('id,rider_profile_id,driver_id,status,quoted_fare,vehicle_class_id').eq('id',rideId).maybeSingle()
    if(!ride)return json({error:'Ride not found.'},404)
    if(ride.rider_profile_id!==profile.id)return json({error:'Only the rider can authorize this fare.'},403)
    if(ride.status!=='accepted'||!ride.driver_id)return json({error:'A driver must accept before fare authorization.'},409)

    const amount=Math.round(Number(ride.quoted_fare)*100)
    if(!Number.isFinite(amount)||amount<50)return json({error:'Ride fare is invalid.'},422)

    const existing=await admin.from('lm_payments').select('id,stripe_payment_intent_id,status').eq('ride_id',rideId).maybeSingle()
    let intent:Stripe.PaymentIntent
    if(existing.data?.stripe_payment_intent_id && !['failed','canceled','refunded'].includes(existing.data.status)){
      intent=await stripe.paymentIntents.retrieve(existing.data.stripe_payment_intent_id)
    }else{
      intent=await stripe.paymentIntents.create({
        amount,
        currency:'usd',
        capture_method:'manual',
        automatic_payment_methods:{enabled:true,allow_redirects:'never'},
        description:`LUXE Mobility — ${ride.vehicle_class_id}`,
        metadata:{app:'luxe_mobility',brand:'LUXE',ride_id:rideId,vehicle_class_id:ride.vehicle_class_id}
      },{idempotencyKey:`luxe-mobility-authorize-${rideId}`})
    }

    const {data:payment,error:paymentError}=await admin.from('lm_payments').upsert({
      ride_id:rideId,
      rider_profile_id:profile.id,
      amount_authorized:amount,
      currency:'usd',
      stripe_payment_intent_id:intent.id,
      status:intent.status==='requires_capture'?'authorized':'pending',
      authorized_at:intent.status==='requires_capture'?new Date().toISOString():null,
      updated_at:new Date().toISOString()
    },{onConflict:'ride_id'}).select('id').single()
    if(paymentError)return json({error:'Payment ledger update failed.'},500)
    return json({paymentId:payment.id,clientSecret:intent.client_secret,amount,status:intent.status})
  }

  if(action==='verify'){
    const {data:ride}=await admin.from('lm_rides').select('rider_profile_id').eq('id',rideId).maybeSingle()
    if(!ride||ride.rider_profile_id!==profile.id)return json({error:'Ride not found.'},404)
    const {data:payment}=await admin.from('lm_payments').select('*').eq('ride_id',rideId).maybeSingle()
    if(!payment?.stripe_payment_intent_id)return json({error:'Payment authorization was not started.'},404)
    const intent=await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id)
    if(intent.status==='requires_capture'){
      await admin.from('lm_payments').update({status:'authorized',authorized_at:new Date().toISOString(),amount_authorized:intent.amount,updated_at:new Date().toISOString()}).eq('id',payment.id)
    }
    return json({status:intent.status,authorized:intent.status==='requires_capture'})
  }

  if(action==='capture'){
    const {data:driver}=await admin.from('lm_drivers').select('id,profile_id').eq('profile_id',profile.id).eq('approval_status','approved').maybeSingle()
    if(!driver)return json({error:'Approved driver required.'},403)
    const {data:ride}=await admin.from('lm_rides').select('id,driver_id,status,quoted_fare').eq('id',rideId).maybeSingle()
    if(!ride||ride.driver_id!==driver.id||ride.status!=='completed')return json({error:'Completed assigned ride required.'},409)
    const {data:payment}=await admin.from('lm_payments').select('*').eq('ride_id',rideId).maybeSingle()
    if(!payment?.stripe_payment_intent_id||payment.status!=='authorized')return json({error:'Authorized payment required.'},409)
    const intent=await stripe.paymentIntents.capture(payment.stripe_payment_intent_id,{}, {idempotencyKey:`luxe-mobility-capture-${payment.id}`})
    await admin.from('lm_payments').update({status:intent.status==='succeeded'?'captured':payment.status,amount_captured:intent.amount_received,captured_at:intent.status==='succeeded'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',payment.id)
    return json({status:intent.status,amountCaptured:intent.amount_received})
  }

  return json({error:'Unsupported payment action.'},400)
})
