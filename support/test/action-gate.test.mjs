import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionGate} from '../src/actionGate.ts';

test('rapid repeated submit starts one write before React renders busy state',()=>{
 const gate=createActionGate(),first=gate.begin();
 assert.notEqual(first,null);assert.equal(gate.begin(),null);assert.equal(gate.isCurrent(first),true);
});
test('success and failure both release the action for a safe retry',()=>{
 const gate=createActionGate(),first=gate.begin();assert.equal(gate.finish(first),true);
 const retry=gate.begin();assert.notEqual(retry,null);assert.notEqual(retry,first);
 assert.equal(gate.finish(first),false);assert.equal(gate.isCurrent(retry),true);
});
test('navigation or sign-out prevents a late response reopening a private conversation',async()=>{
 const gate=createActionGate(),first=gate.begin();let completed=false;
 const late=Promise.resolve().then(()=>{if(gate.isCurrent(first))completed=true;});
 gate.invalidate();await late;
 assert.equal(completed,false);assert.equal(gate.finish(first),false);assert.equal(gate.begin(),null);
});
