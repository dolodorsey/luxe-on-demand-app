import { NextResponse } from 'next/server'
import { LUXE_BACKEND_MODE, LUXE_MOBILITY_PUBLISHABLE_KEY, LUXE_MOBILITY_SUPABASE_URL } from '../../../../config/luxe-mobility-backend'

export const dynamic='force-dynamic'

export async function GET(){
  const started=Date.now()
  try{
    const response=await fetch(`${LUXE_MOBILITY_SUPABASE_URL}/rest/v1/lm_vehicle_classes?select=id,name&is_active=eq.true&order=sort_order`,{
      headers:{apikey:LUXE_MOBILITY_PUBLISHABLE_KEY,Authorization:`Bearer ${LUXE_MOBILITY_PUBLISHABLE_KEY}`},
      cache:'no-store',signal:AbortSignal.timeout(5000),
    })
    if(!response.ok)return NextResponse.json({status:'degraded',app:'LUXE Mobility',backend:LUXE_BACKEND_MODE,database:'unreachable',latency_ms:Date.now()-started},{status:503})
    const classes=await response.json()
    return NextResponse.json({status:'ok',app:'LUXE Mobility',backend:LUXE_BACKEND_MODE,database:'reachable',vehicle_classes:Array.isArray(classes)?classes.length:0,latency_ms:Date.now()-started,timestamp:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})
  }catch{
    return NextResponse.json({status:'degraded',app:'LUXE Mobility',backend:LUXE_BACKEND_MODE,database:'unreachable',latency_ms:Date.now()-started},{status:503})
  }
}
