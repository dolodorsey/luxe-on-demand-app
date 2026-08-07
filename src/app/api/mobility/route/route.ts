import { NextResponse } from 'next/server'

const GOOGLE_ROUTES_URL='https://routes.googleapis.com/directions/v2:computeRoutes'

function parseDurationSeconds(value:string|undefined){
  if(!value)return 0
  const match=value.match(/^([0-9.]+)s$/)
  return match?Number(match[1]):0
}

export async function POST(request:Request){
  try{
    const body=await request.json()
    const origin=String(body?.origin||'').trim()
    const destination=String(body?.destination||'').trim()
    if(origin.length<3||destination.length<3)return NextResponse.json({error:'Pickup and destination are required.'},{status:400})

    const apiKey=process.env.GOOGLE_MAPS_ROUTES_API_KEY
    if(!apiKey)return NextResponse.json({error:'LUXE routing is not configured on this environment.'},{status:503})

    const upstream=await fetch(GOOGLE_ROUTES_URL,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Goog-Api-Key':apiKey,
        'X-Goog-FieldMask':'routes.distanceMeters,routes.duration',
      },
      body:JSON.stringify({
        origin:{address:origin},
        destination:{address:destination},
        travelMode:'DRIVE',
        routingPreference:'TRAFFIC_AWARE',
        languageCode:'en-US',
        units:'IMPERIAL',
      }),
      cache:'no-store',
    })

    const payload=await upstream.json()
    if(!upstream.ok)return NextResponse.json({error:'LUXE could not calculate this route.',details:payload?.error?.status||null},{status:502})
    const route=payload?.routes?.[0]
    const distanceMeters=Number(route?.distanceMeters||0)
    const durationSeconds=parseDurationSeconds(route?.duration)
    if(distanceMeters<=0||durationSeconds<=0)return NextResponse.json({error:'No drivable route was returned.'},{status:422})

    return NextResponse.json({
      distanceMiles:Number((distanceMeters/1609.344).toFixed(2)),
      durationMinutes:Math.max(1,Math.ceil(durationSeconds/60)),
      source:'google-routes-v2',
    },{headers:{'Cache-Control':'no-store'}})
  }catch{
    return NextResponse.json({error:'Invalid route request.'},{status:400})
  }
}
