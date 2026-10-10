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
for(const error of [new Error('Withdrawn application must be returned to review before approval'),{message:'Withdrawn application must be returned to review before approval',code:'P0001'}]){
 test(`approval rejection stays unsuccessful (${error instanceof Error?'Error':'RPC object'})`,async()=>{
  const busy=[],messages=[],calls=[];let loads=0;
  const context={Error,setBusy:v=>busy.push(v),setMessage:v=>messages.push(v),load:async()=>{loads++},luxeMobility:{rpc:async(...args)=>{calls.push(args);return {error}}}};
  const approve=vm.runInNewContext(code+';approve',context);
  await approve({id:'qa-application',review_note:null});
  assert.equal(calls.length,1);assert.equal(calls[0][0],'lm_approve_driver_application');
  assert.equal(loads,0);assert.deepEqual(busy,['qa-application','']);
  assert.equal(messages.at(-1),error instanceof Error?error.message:'Driver approval failed');
  assert(!messages.some(x=>x.startsWith('Driver approved.')));
 });
}
