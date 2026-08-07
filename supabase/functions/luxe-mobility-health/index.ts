import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const headers={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, max-age=0',
  'Access-Control-Allow-Origin':'*',
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers})
  if(req.method!=='GET')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers})
  const started=Date.now()
  const url=Deno.env.get('SUPABASE_URL')
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!serviceRole)return new Response(JSON.stringify({status:'degraded',app:'LUXE Mobility',database:'unconfigured'}),{status:503,headers})

  const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const [classes,drivers,rides]=await Promise.all([
    admin.from('lm_vehicle_classes').select('id',{count:'exact',head:true}).eq('is_active',true),
    admin.from('lm_drivers').select('id',{count:'exact',head:true}).eq('approval_status','approved').eq('on_duty',true),
    admin.from('lm_rides').select('id',{count:'exact',head:true}).in('status',['matching','accepted','en_route','arrived','in_progress']),
  ])
  const ok=!classes.error&&!drivers.error&&!rides.error
  return new Response(JSON.stringify({
    status:ok?'ok':'degraded',
    app:'LUXE Mobility',
    backend:'controlled-staging',
    database:ok?'reachable':'unreachable',
    vehicle_classes:classes.count??null,
    on_duty_drivers:drivers.count??null,
    active_rides:rides.count??null,
    latency_ms:Date.now()-started,
    timestamp:new Date().toISOString(),
  }),{status:ok?200:503,headers})
})
