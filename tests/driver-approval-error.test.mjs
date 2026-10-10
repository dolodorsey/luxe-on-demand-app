import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {test} from 'node:test';
const source=readFileSync(new URL('../src/components/LuxeDriverReview.tsx',import.meta.url),'utf8');
const start=source.indexOf('  const approve=async');
const end=source.indexOf('\n  if(loading)',start);
assert(start>=0 && end>start);
const code=stripTypeScriptTypes(source.slice(start,end));
const withdrawn='This application was withdrawn. Confirm that returning it to review is authorized, then use Save review before approving.';
const cases=[
 ['withdrawn Error',new Error('Withdrawn application must be returned to review before approval'),withdrawn],
 ['withdrawn RPC object',{message:'Withdrawn application must be returned to review before approval',code:'P0001'},withdrawn],
 ['rejected RPC object',{message:'Rejected application must be returned to review before approval',code:'P0001'},'This application was rejected. Complete an authorized review, then use Save review before approving.'],
 ['unknown RPC object',{message:'private backend diagnostic',code:'XX000'},'Driver approval failed'],
 ['network Error',new Error('Network unavailable'),'Network unavailable'],
];
for(const [name,error,expected] of cases){
 test(`approval rejection recovery (${name})`,async()=>{
  const busy=[],messages=[],calls=[];let loads=0;
  const context={Error,setBusy:v=>busy.push(v),setMessage:v=>messages.push(v),load:async()=>{loads++},luxeMobility:{rpc:async(...args)=>{calls.push(args);return {error}}}};
  const approve=vm.runInNewContext(code+';approve',context);
  await approve({id:'qa-application',review_note:null});
  assert.equal(calls.length,1);assert.equal(calls[0][0],'lm_approve_driver_application');
  assert.equal(loads,0);assert.deepEqual(busy,['qa-application','']);
  assert.equal(messages.at(-1),expected);
  assert(!messages.some(x=>x.startsWith('Driver approved.')));
 });
}
