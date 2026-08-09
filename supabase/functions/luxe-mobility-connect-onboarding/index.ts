import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@18.5.0'
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
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeSecret=Deno.env.get('LUXE_MOBILITY_STRIPE_SECRET_KEY') || Deno.env.get('STRIPE_SECRET_KEY')
  if(!url||!anon||!serviceRole||!stripeSecret)return json({error:'LUXE payout onboarding is not configured.'},503)

  const authorization=req.headers.get('Authorization')||''
  const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}})
  const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:{user},error:userError}=await userClient.auth.getUser()
  if(userError||!user)return json({error:'Authentication required.'},401)

  const {data:profile}=await admin.from('lm_profiles').select('id,full_name').eq('auth_id',user.id).eq('role','driver').eq('status','active').maybeSingle()
  if(!profile)return json({error:'Approved LUXE driver profile required.'},403)
  const {data:driver}=await admin.from('lm_drivers').select('*').eq('profile_id',profile.id).eq('approval_status','approved').maybeSingle()
  if(!driver)return json({error:'Approved LUXE driver required.'},403)

  const stripe=new Stripe(stripeSecret,{httpClient:Stripe.createFetchHttpClient()})
  let accountId=driver.stripe_account_id as string|null
  if(!accountId){
    const account=await stripe.accounts.create({
      type:'express',country:'US',email:user.email||undefined,business_type:'individual',
      capabilities:{transfers:{requested:true}},
      metadata:{app:'luxe_mobility',brand:'LUXE',driver_id:driver.id,profile_id:profile.id}
    },{idempotencyKey:`luxe-driver-${driver.id}-connect-v1`})
    accountId=account.id
    await admin.from('lm_drivers').update({stripe_account_id:accountId,payouts_enabled:false,updated_at:new Date().toISOString()}).eq('id',driver.id)
  }

  const origin=Deno.env.get('LUXE_APP_ORIGIN') || 'https://luxe-on-demand-app.vercel.app'
  const link=await stripe.accountLinks.create({account:accountId,type:'account_onboarding',refresh_url:`${origin}/driver?connect=refresh`,return_url:`${origin}/driver?connect=return`})
  return json({url:link.url})
})
