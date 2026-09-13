import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const GOOGLE_ROUTES_URL='https://routes.googleapis.com/directions/v2:computeRoutes'
const ROUTING_TIMEOUT_MS=8_000

function durationSeconds(value:string|undefined){
  if(!value)return 0
  const match=value.match(/^([0-9.]+)s$/)
  return match?Number(match[1]):0
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)

  const body=await req.json().catch(()=>({})) as {origin?:string;destination?:string}
  const pickup=String(body.origin||'').trim()
  const destination=String(body.destination||'').trim()
  if(pickup.length<3||destination.length<3)return json({error:'Pickup and destination are required.'},400)

  const url=Deno.env.get('SUPABASE_URL')
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!serviceRole)return json({error:'LUXE routing runtime is unavailable.',code:'routing_runtime_unconfigured'},503)
  const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const direct=Deno.env.get('GOOGLE_MAPS_ROUTES_API_KEY')?.trim()
  const vault=direct?'':await admin.rpc('lm_get_runtime_secret',{p_key:'GOOGLE_MAPS_ROUTES_API_KEY'}).then(({data,error})=>error||typeof data!=='string'?'':data.trim())
  const apiKey=direct||vault
  if(!apiKey)return json({error:'LUXE routing provider is not configured.',code:'routing_provider_unconfigured'},503)

  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),ROUTING_TIMEOUT_MS)
  let upstream:Response
  try{
    upstream=await fetch(GOOGLE_ROUTES_URL,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Goog-Api-Key':apiKey,
        'X-Goog-FieldMask':'routes.distanceMeters,routes.duration,routes.staticDuration'
      },
      body:JSON.stringify({
        origin:{address:pickup},
        destination:{address:destination},
        travelMode:'DRIVE',
        routingPreference:'TRAFFIC_AWARE',
        languageCode:'en-US',
        units:'IMPERIAL'
      }),
      signal:controller.signal,
    })
  }catch(error){
    return json({error:'LUXE routing provider did not respond.',code:error instanceof DOMException&&error.name==='AbortError'?'routing_timeout':'routing_upstream_unreachable'},502)
  }finally{clearTimeout(timeout)}

  const payload=await upstream.json().catch(()=>({}))
  if(!upstream.ok)return json({error:'LUXE could not calculate this route.',code:payload?.error?.status||'routing_upstream_error'},502)
  const route=payload?.routes?.[0]
  const meters=Number(route?.distanceMeters||0)
  const seconds=durationSeconds(route?.duration)||durationSeconds(route?.staticDuration)
  if(meters<=0||seconds<=0)return json({error:'No drivable route was returned.',code:'no_route'},422)

  return json({distanceMiles:Number((meters/1609.344).toFixed(2)),durationMinutes:Math.max(1,Math.ceil(seconds/60)),source:'google-routes-v2'})
})
