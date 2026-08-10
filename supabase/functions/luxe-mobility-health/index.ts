import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const headers={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, max-age=0',
  'Access-Control-Allow-Origin':'*',
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers})
  if(req.method!=='GET'&&req.method!=='HEAD')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers})
  const started=Date.now()
  const url=Deno.env.get('SUPABASE_URL')
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!serviceRole)return new Response(JSON.stringify({status:'degraded',app:'LUXE Mobility',database:'unconfigured',launch_ready:false}),{status:503,headers})
  const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const [classes,approved,payoutReady,onDuty,rides]=await Promise.all([
    admin.from('lm_vehicle_classes').select('id',{count:'exact',head:true}).eq('is_active',true),
    admin.from('lm_drivers').select('id',{count:'exact',head:true}).eq('approval_status','approved'),
    admin.from('lm_drivers').select('id',{count:'exact',head:true}).eq('approval_status','approved').eq('payouts_enabled',true),
    admin.from('lm_drivers').select('id',{count:'exact',head:true}).eq('approval_status','approved').eq('payouts_enabled',true).eq('on_duty',true),
    admin.from('lm_rides').select('id',{count:'exact',head:true}).in('status',['matching','accepted','en_route','arrived','in_progress']),
  ])
  const databaseOk=!classes.error&&!approved.error&&!payoutReady.error&&!onDuty.error&&!rides.error
  if(!databaseOk){
    const errors=[classes.error,approved.error,payoutReady.error,onDuty.error,rides.error].filter(Boolean).map(error=>error?.message)
    return new Response(JSON.stringify({status:'degraded',app:'LUXE Mobility',backend:'shared-sos-on-call-project',project_ref:'cxdqkjvtpilvouwtbgdy',database:'unreachable',launch_ready:false,errors,latency_ms:Date.now()-started,timestamp:new Date().toISOString()}),{status:503,headers})
  }
  const routingConfigured=Boolean(Deno.env.get('GOOGLE_MAPS_ROUTES_API_KEY'))
  const stripeServerConfigured=Boolean(Deno.env.get('LUXE_MOBILITY_STRIPE_SECRET_KEY')||Deno.env.get('STRIPE_SECRET_KEY'))
  const stripeWebhookConfigured=Boolean(Deno.env.get('LUXE_MOBILITY_STRIPE_WEBHOOK_SECRET'))
  const activeClasses=classes.count??0
  const approvedDrivers=approved.count??0
  const payoutReadyDrivers=payoutReady.count??0
  const onDutyDrivers=onDuty.count??0
  const launchReady=activeClasses>0&&onDutyDrivers>0&&routingConfigured&&stripeServerConfigured&&stripeWebhookConfigured
  const blockers:string[]=[]
  if(activeClasses<=0)blockers.push('vehicle_classes')
  if(approvedDrivers<=0)blockers.push('approved_driver_supply')
  else if(payoutReadyDrivers<=0)blockers.push('payout_ready_driver_supply')
  else if(onDutyDrivers<=0)blockers.push('on_duty_driver_supply')
  if(!routingConfigured)blockers.push('routing_provider')
  if(!stripeServerConfigured)blockers.push('stripe_server')
  if(!stripeWebhookConfigured)blockers.push('stripe_webhook')
  const body={
    status:launchReady?'ready':'gated',app:'LUXE Mobility',backend:'shared-sos-on-call-project',project_ref:'cxdqkjvtpilvouwtbgdy',database:'reachable',launch_ready:launchReady,
    vehicle_classes:activeClasses,approved_drivers:approvedDrivers,payout_ready_drivers:payoutReadyDrivers,on_duty_drivers:onDutyDrivers,active_rides:rides.count??0,
    routing_provider_configured:routingConfigured,stripe_server_configured:stripeServerConfigured,stripe_webhook_configured:stripeWebhookConfigured,blockers,
    latency_ms:Date.now()-started,timestamp:new Date().toISOString(),
  }
  if(req.method==='HEAD')return new Response(null,{status:200,headers})
  return new Response(JSON.stringify(body),{status:200,headers})
})