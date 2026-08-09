import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const GOOGLE_ROUTES_URL='https://routes.googleapis.com/directions/v2:computeRoutes'

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

  const apiKey=Deno.env.get('GOOGLE_MAPS_ROUTES_API_KEY')
  if(!apiKey)return json({error:'LUXE routing provider is not configured.',code:'routing_provider_unconfigured'},503)

  const upstream=await fetch(GOOGLE_ROUTES_URL,{
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
    })
  })

  const payload=await upstream.json().catch(()=>({}))
  if(!upstream.ok)return json({error:'LUXE could not calculate this route.',code:payload?.error?.status||'routing_upstream_error'},502)
  const route=payload?.routes?.[0]
  const meters=Number(route?.distanceMeters||0)
  const seconds=durationSeconds(route?.duration)||durationSeconds(route?.staticDuration)
  if(meters<=0||seconds<=0)return json({error:'No drivable route was returned.',code:'no_route'},422)

  return json({distanceMiles:Number((meters/1609.344).toFixed(2)),durationMinutes:Math.max(1,Math.ceil(seconds/60)),source:'google-routes-v2'})
})
