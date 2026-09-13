import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const headers={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, max-age=0',
  'Access-Control-Allow-Origin':'*',
}
const STRIPE_TIMEOUT_MS=5_000
const EXPECTED_WEBHOOK_URL='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/luxe-mobility-stripe-webhook'
const PAYMENT_EVENTS=['payment_intent.amount_capturable_updated','payment_intent.succeeded','payment_intent.canceled','payment_intent.payment_failed','charge.dispute.created','charge.refunded']
const CONNECT_EVENTS=['account.updated']

type StripeProbe={ok:boolean;status:number;latency_ms:number;payload:any}

async function stripeGet(path:string,key:string):Promise<StripeProbe>{
  const started=Date.now()
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),STRIPE_TIMEOUT_MS)
  try{
    const response=await fetch(`https://api.stripe.com${path}`,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},signal:controller.signal})
    const payload=await response.json().catch(()=>null)
    return {ok:response.ok,status:response.status,latency_ms:Date.now()-started,payload}
  }catch(error){
    return {ok:false,status:0,latency_ms:Date.now()-started,payload:{error:error instanceof Error?error.message:'stripe_probe_failed'}}
  }finally{clearTimeout(timeout)}
}

function endpointHasEvents(endpoint:any,required:string[]){
  const enabled=Array.isArray(endpoint?.enabled_events)?endpoint.enabled_events:[]
  return required.every(event=>enabled.includes('*')||enabled.includes(event))
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers})
  if(req.method!=='GET'&&req.method!=='HEAD')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers})
  const started=Date.now()
  const url=Deno.env.get('SUPABASE_URL')
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!serviceRole)return new Response(JSON.stringify({status:'degraded',app:'LUXE Mobility',database:'unconfigured',service_ready:false,launch_ready:false}),{status:503,headers})

  const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const readSecret=async(name:string)=>{
    const direct=Deno.env.get(name)?.trim()
    if(direct)return direct
    const {data,error}=await admin.rpc('lm_get_runtime_secret',{p_key:name})
    return error||typeof data!=='string'||!data.trim()?'':data.trim()
  }

  const [classes,applications,activeApplications,approved,payoutReady,onDuty,rides,payments,feeResult,stripeSecret,routingSecret]=await Promise.all([
    admin.from('lm_vehicle_classes').select('id',{count:'exact',head:true}).eq('is_active',true),
    admin.from('lm_driver_applications').select('id',{count:'exact',head:true}),
    admin.from('lm_driver_applications').select('id',{count:'exact',head:true}).in('application_status',['submitted','under_review','approved']),
    admin.from('lm_drivers').select('id',{count:'exact',head:true}).eq('approval_status','approved'),
    admin.from('lm_drivers').select('id',{count:'exact',head:true}).eq('approval_status','approved').eq('payouts_enabled',true),
    admin.from('lm_drivers').select('id',{count:'exact',head:true}).eq('approval_status','approved').eq('payouts_enabled',true).eq('on_duty',true),
    admin.from('lm_rides').select('id',{count:'exact',head:true}),
    admin.from('lm_payments').select('id',{count:'exact',head:true}),
    admin.rpc('lm_get_runtime_integer',{p_key:'platform_fee_bps'}),
    (async()=>await readSecret('LUXE_MOBILITY_STRIPE_SECRET_KEY')||await readSecret('STRIPE_SECRET_KEY'))(),
    readSecret('GOOGLE_MAPS_ROUTES_API_KEY'),
  ])

  const databaseResults=[classes,applications,activeApplications,approved,payoutReady,onDuty,rides,payments]
  const databaseErrors=databaseResults.flatMap(result=>result.error?[result.error.message]:[])
  if(feeResult.error)databaseErrors.push(feeResult.error.message)
  const databaseOk=databaseErrors.length===0
  if(!databaseOk){
    return new Response(JSON.stringify({status:'degraded',app:'LUXE Mobility',backend:'shared-sos-on-call-project',project_ref:'cxdqkjvtpilvouwtbgdy',database:'unreachable',service_ready:false,launch_ready:false,errors:databaseErrors,latency_ms:Date.now()-started,timestamp:new Date().toISOString()}),{status:503,headers})
  }

  const [balanceProbe,webhookProbe]=stripeSecret?await Promise.all([
    stripeGet('/v1/balance',stripeSecret),
    stripeGet('/v1/webhook_endpoints?limit=100',stripeSecret),
  ]):[null,null]

  const stripeApiReachable=Boolean(balanceProbe?.ok&&balanceProbe?.payload?.object==='balance')
  const webhookEndpoints=Array.isArray(webhookProbe?.payload?.data)?webhookProbe.payload.data:[]
  const currentEndpoints=webhookEndpoints.filter((endpoint:any)=>endpoint?.url===EXPECTED_WEBHOOK_URL&&endpoint?.status==='enabled')
  const paymentWebhookReady=currentEndpoints.some((endpoint:any)=>endpointHasEvents(endpoint,PAYMENT_EVENTS))
  const connectWebhookReady=currentEndpoints.some((endpoint:any)=>endpointHasEvents(endpoint,CONNECT_EVENTS))
  const platformFeeBps=feeResult.data===null||feeResult.data===undefined?null:Number(feeResult.data)
  const platformFeeConfigured=Number.isInteger(platformFeeBps)&&Number(platformFeeBps)>=0&&Number(platformFeeBps)<=10_000
  const routingConfigured=Boolean(routingSecret)

  const activeClasses=classes.count??0
  const driverApplications=applications.count??0
  const activeDriverApplications=activeApplications.count??0
  const approvedDrivers=approved.count??0
  const payoutReadyDrivers=payoutReady.count??0
  const onDutyDrivers=onDuty.count??0
  const paymentRailReady=stripeApiReachable&&paymentWebhookReady&&connectWebhookReady
  const serviceReady=databaseOk&&paymentRailReady
  const launchReady=serviceReady&&activeClasses>0&&onDutyDrivers>0&&routingConfigured&&platformFeeConfigured

  const blockers:string[]=[]
  if(activeClasses<=0)blockers.push('vehicle_classes')
  if(approvedDrivers<=0)blockers.push('approved_driver_supply')
  else if(payoutReadyDrivers<=0)blockers.push('payout_ready_driver_supply')
  else if(onDutyDrivers<=0)blockers.push('on_duty_driver_supply')
  if(!routingConfigured)blockers.push('routing_provider')
  if(!platformFeeConfigured)blockers.push('settlement_fee')
  if(!stripeSecret)blockers.push('stripe_server')
  else if(!stripeApiReachable)blockers.push('stripe_server_reachability')
  if(!webhookProbe?.ok)blockers.push('stripe_webhook_inventory')
  else{
    if(!paymentWebhookReady)blockers.push('stripe_payment_webhook')
    if(!connectWebhookReady)blockers.push('stripe_connect_webhook')
  }

  const body={
    status:launchReady?'ready':'gated',
    app:'LUXE Mobility',
    backend:'shared-sos-on-call-project',
    project_ref:'cxdqkjvtpilvouwtbgdy',
    database:'reachable',
    service_ready:serviceReady,
    launch_ready:launchReady,
    vehicle_classes:activeClasses,
    driver_applications:driverApplications,
    active_driver_applications:activeDriverApplications,
    approved_drivers:approvedDrivers,
    payout_ready_drivers:payoutReadyDrivers,
    on_duty_drivers:onDutyDrivers,
    rides:rides.count??0,
    payments:payments.count??0,
    routing_provider_configured:routingConfigured,
    platform_fee_configured:platformFeeConfigured,
    platform_fee_bps:platformFeeConfigured?platformFeeBps:null,
    stripe_server_configured:Boolean(stripeSecret),
    stripe_api_reachable:stripeApiReachable,
    stripe_api_status:balanceProbe?.status??null,
    stripe_api_latency_ms:balanceProbe?.latency_ms??null,
    stripe_webhook_inventory_reachable:Boolean(webhookProbe?.ok),
    stripe_payment_webhook_ready:paymentWebhookReady,
    stripe_connect_webhook_ready:connectWebhookReady,
    stripe_webhook_target:EXPECTED_WEBHOOK_URL,
    blockers,
    latency_ms:Date.now()-started,
    timestamp:new Date().toISOString(),
  }
  if(req.method==='HEAD')return new Response(null,{status:200,headers})
  return new Response(JSON.stringify(body),{status:200,headers})
})
