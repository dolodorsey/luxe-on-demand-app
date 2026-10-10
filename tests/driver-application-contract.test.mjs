import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base=new URL('../',import.meta.url);
const caller=readFileSync(new URL('src/components/LuxeDriverApplication.tsx',base),'utf8');
const start=caller.indexOf('  const submit=async');const end=caller.indexOf('\n  if(booting)',start);
assert.ok(start>=0&&end>start,'actual submit function present');
const submitSource=stripTypeScriptTypes(caller.slice(start,end)+'\nglobalThis.submit=submit;');
const handlerSource=stripTypeScriptTypes(readFileSync(new URL('supabase/functions/luxe-driver-application/index.ts',base),'utf8').replace(/^import .*\n/gm,''));
const form={fullName:'QA Driver',email:'qa@example.invalid',phone:'5550100',city:'Atlanta',stateCode:'GA',vehicleClassId:'fixture',vehicleMake:'Test',vehicleModel:'Model',vehicleYear:2025,vehicleColor:'Blue',vehiclePlate:'QA123',note:''};
async function setup(opts={}){
 const events={rpc:[],queries:[],messages:[],applications:[],busy:[],clients:[],invocations:[]};let handler;
 const client={auth:{getUser:async()=>({data:{user:opts.unauthorized?null:{id:'trusted-user',email:form.email}},error:null})},rpc:async(name,args)=>{events.rpc.push({name,args});return opts.rpcError?{data:null,error:{message:'Review hold'}}:{data:{id:'fixture-application',application_status:'submitted'},error:null}},from:table=>({select:selection=>({eq:(key,value)=>({maybeSingle:async()=>{events.queries.push({table,selection,key,value});return {data:null,error:opts.statusError?{message:'Read failed'}:null}}})})})};
 vm.runInNewContext(handlerSource,{Request,Response,Deno:{env:{get:()=> 'fixture'},serve:fn=>handler=fn},createClient:(...args)=>{events.clients.push(args);return client},fetch:()=>{throw Error('No network')}});
 const request=body=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:'Bearer synthetic-token'},body:JSON.stringify(body)}));
 const context={form:{...form,...opts.form},busy:!!opts.busy,setBusy:v=>events.busy.push(v),setMessage:v=>events.messages.push(v),setApplication:v=>events.applications.push(v),luxeMobility:{functions:{invoke:async(name,{body})=>{events.invocations.push(name);const response=await request(body);const data=await response.json();return response.ok?{data,error:null}:{data:null,error:new Error(data.error)}}}}};
 vm.runInNewContext(submitSource,context);
 return {events,request,submit:()=>context.submit({preventDefault(){}})};
}
let checks=0;
for(const year of [2025,'2025']){const t=await setup({form:{vehicleYear:year}});await t.submit();assert.equal(t.events.rpc.length,1);assert.equal(t.events.rpc[0].name,'lm_submit_driver_application');assert.equal(t.events.rpc[0].args.p_vehicle_year,2025);assert.equal(t.events.rpc[0].args.p_full_name,form.fullName);assert.equal(t.events.applications[0].application_status,'submitted');assert.equal(t.events.clients[0][2].global.headers.Authorization,'Bearer synthetic-token');assert.equal(t.events.clients[0][2].auth.persistSession,false);assert.equal(t.events.busy.at(-1),false);checks++}
for(const options of [{unauthorized:true},{rpcError:true},{form:{fullName:{}}}]){const t=await setup(options);await t.submit();assert.equal(t.events.applications.length,0);assert.ok(!t.events.messages.at(-1).includes('Application received'));assert.equal(t.events.busy.at(-1),false);if(!options.rpcError)assert.equal(t.events.rpc.length,0);checks++}
{const t=await setup({busy:true});await t.submit();assert.equal(t.events.invocations.length,0);checks++}
{const t=await setup();const r=await t.request({action:'status',auth_id:'other-user'});assert.equal(r.status,200);assert.deepEqual(t.events.queries,[{table:'lm_driver_applications',selection:'*',key:'auth_id',value:'trusted-user'}]);assert.equal(t.events.rpc.length,0);checks++}
{const t=await setup({statusError:true});assert.equal((await t.request({action:'status'})).status,400);checks++}
{const t=await setup();await t.request({...form,action:'submit',auth_id:'other-user',application_status:'approved',payouts_enabled:true});const args=t.events.rpc[0].args;assert.ok(!('auth_id' in args)&&!('application_status' in args)&&!('payouts_enabled' in args));checks++}
console.log({actual_caller_handler_checks:checks,network_calls:0,real_applications:0});
