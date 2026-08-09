import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)

  const url=Deno.env.get('SUPABASE_URL')
  const anon=Deno.env.get('SUPABASE_ANON_KEY')
  if(!url||!anon)return json({error:'LUXE driver application service is unavailable.'},503)

  const authorization=req.headers.get('Authorization')||''
  const client=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}})
  const {data:{user},error:userError}=await client.auth.getUser()
  if(userError||!user)return json({error:'Authentication required.'},401)

  const body=await req.json().catch(()=>({})) as Record<string,unknown>
  const action=String(body.action||'submit')

  if(action==='status'){
    const {data,error}=await client.from('lm_driver_applications').select('*').eq('auth_id',user.id).maybeSingle()
    if(error)return json({error:error.message},400)
    return json({application:data})
  }

  if(action!=='submit')return json({error:'Unsupported action.'},400)

  const vehicleYear=Number(body.vehicleYear)
  const {data,error}=await client.rpc('lm_submit_driver_application',{
    p_full_name:String(body.fullName||''),
    p_email:String(body.email||user.email||''),
    p_phone:String(body.phone||''),
    p_city:String(body.city||''),
    p_state_code:String(body.stateCode||''),
    p_vehicle_class_id:String(body.vehicleClassId||''),
    p_vehicle_make:String(body.vehicleMake||''),
    p_vehicle_model:String(body.vehicleModel||''),
    p_vehicle_year:Number.isFinite(vehicleYear)?vehicleYear:0,
    p_vehicle_color:String(body.vehicleColor||''),
    p_vehicle_plate:String(body.vehiclePlate||''),
    p_applicant_note:String(body.note||'')||null,
  })
  if(error)return json({error:error.message},400)
  return json({application:data},201)
})
