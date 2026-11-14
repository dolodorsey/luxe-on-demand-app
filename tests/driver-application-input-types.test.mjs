import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../supabase/functions/luxe-driver-application/',import.meta.url);
const valid={action:'submit',fullName:'Synthetic QA',email:'qa@example.invalid',phone:'5550100',city:'Atlanta',stateCode:'GA',vehicleClassId:'fixture-class',vehicleMake:'Test',vehicleModel:'Fixture',vehicleYear:'2025',vehicleColor:'Blue',vehiclePlate:'QA00',note:'local fixture only'};
async function run(file,body,authorized=true){
 let handler;const calls=[];
 const source=stripTypeScriptTypes(readFileSync(new URL(file,root),'utf8').replace(/^import .*\n/gm,''));
 const client={auth:{getUser:async()=>({data:{user:authorized?{id:'fixture-user',email:'qa@example.invalid'}:null},error:null})},rpc:async(name,args)=>{calls.push({name,args});return {data:{application_status:'submitted'},error:null}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})};
 vm.runInNewContext(source,{Request,Response,JSON,Number,String,Array,Deno:{env:{get:()=> 'fixture'},serve:fn=>handler=fn},createClient:()=>client,fetch:()=>{throw Error('Network forbidden')}});
 try{return {response:await handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify(body)})),calls}}catch(e){return {error:e.message,calls}}
}
let guarded=0;
const fields=Object.keys(valid).filter(k=>!['action','vehicleYear'].includes(k));
for(const field of fields)for(const value of [{},['unexpected'],true,123]){
 const body={...valid,[field]:value};
 const after=await run('index.ts',body);assert.equal(after.response.status,400);assert.equal(after.calls.length,0);guarded++;
}
for(const value of [null,[],true]){const r=await run('index.ts',value);assert.equal(r.response.status,400);assert.equal(r.calls.length,0);guarded++}
for(const value of [[],{},true,null]){const r=await run('index.ts',{...valid,vehicleYear:value});assert.equal(r.response.status,400);assert.equal(r.calls.length,0);guarded++}
for(const value of [[],{}]){const r=await run('index.ts',{...valid,action:value});assert.equal(r.response.status,400);assert.equal(r.calls.length,0);guarded++}
for(const year of ['2025',2025]){const r=await run('index.ts',{...valid,vehicleYear:year});assert.equal(r.response.status,201);assert.equal(r.calls[0].args.p_vehicle_year,2025);guarded++}
for(const [body,status,auth] of [[{action:'status'},200,true],[valid,401,false],[{...valid,action:'unknown'},400,true]]){const r=await run('index.ts',body,auth);assert.equal(r.response.status,status);assert.equal(r.calls.length,0);guarded++}
console.log({handler_checks_passed:guarded,network_calls:0,real_applications:0});
