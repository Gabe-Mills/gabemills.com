import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../worker.mjs';
const token='a'.repeat(64),code='b'.repeat(64);
const env={SITE_ORIGIN:'https://gabemills.com',SUPABASE_URL:'https://backend.example',SUPABASE_ANON_KEY:'public-test-key',ASSETS:{fetch:async()=>new Response('<h1>Support</h1>',{headers:{'Content-Type':'text/html'}})}};
const request=(body,options={})=>new Request('https://gabemills.com/support/api/'+(options.path||'action'),{method:options.method||'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json',...options.headers},body:options.method==='GET'?undefined:JSON.stringify(body)});
test('cross-origin writes, missing origin and non-JSON are rejected before backend',async()=>{
 const handler=createHandler(()=>assert.fail('Backend must not be called'));
 for(const Origin of ['https://evil.example','null',''])assert.equal((await handler(request({action:'create'},{headers:{Origin}}),env)).status,403);
 assert.equal((await handler(request({action:'create'},{headers:{'Content-Type':'text/plain'}}),env)).status,415);
 assert.equal((await handler(request({},{method:'GET'}),env)).status,405);
});
test('sign-in token becomes a secure HttpOnly cookie, never returned to browser JS',async()=>{
 const handler=createHandler(async(url,options)=>{assert.ok(url.endsWith('/exchange_support_signin_code'));assert.deepEqual(JSON.parse(options.body),{p_code:code});return Response.json({token,expires_in:604800});});
 const r=await handler(request({code},{path:'signin'}),env);
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});
 for(const part of ['HttpOnly','Secure','SameSite=Strict','Path=/support','Max-Age=604800'])assert.ok(r.headers.get('set-cookie').includes(part));
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('session/body spoofing cannot inject another identity or arbitrary RPC',async()=>{
 const handler=createHandler(async(url,options)=>{assert.ok(url.endsWith('/support_portal'));const b=JSON.parse(options.body);assert.equal(b.p_session,token);assert.equal(b.p_action,'session');return Response.json({signedIn:true,admin:false});});
 const r=await handler(request({action:'session',p_session:'fake',user_id:'admin'},{headers:{Cookie:`__Secure-topbook-support=${token}`}}),env);assert.equal(r.status,200);
 assert.equal((await handler(request({action:'delete_own_account'}),env)).status,404);
});
test('logout invalidates session and clears only support cookie',async()=>{
 const handler=createHandler(async()=>Response.json({ok:true}));const r=await handler(request({action:'logout'}),env);
 assert.match(r.headers.get('set-cookie'),/Max-Age=0/);assert.match(r.headers.get('set-cookie'),/Path=\/support/);
});
test('private errors cannot expose database/stack information',async()=>{
 const handler=createHandler(async()=>Response.json({code:'XX000',message:'private database password STACK'},{status:500}));
 const r=await handler(request({action:'inbox'}),env);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/password|STACK/);
});
test('unauthorized responses and offline failures stay failures',async()=>{
 const denied=createHandler(async()=>Response.json({code:'42501',message:'Admin access required.'},{status:403}));assert.equal((await denied(request({action:'inbox'}),env)).status,403);
 const offline=createHandler(async()=>{throw Error('secret-host');});const r=await offline(request({action:'reply'}),env);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/secret-host/);
});
test('invalid and oversized request bodies are bounded',async()=>{
 const handler=createHandler(()=>assert.fail('Backend must not be called'));
 assert.equal((await handler(request({action:'reply',data:{body:'x'.repeat(21000)}}),env)).status,413);
 assert.equal((await handler(request({code:'short'},{path:'signin'}),env)).status,400);
 assert.equal((await handler(request([],{}),env)).status,400);
});
test('support pages have CSP, privacy headers, and admin is not indexed',async()=>{
 const r=await createHandler()(new Request('https://gabemills.com/support/desk/bookmark'),env);
 assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(r.headers.get('referrer-policy'),'no-referrer');
 assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/support/sign-in');
 assert.equal((await createHandler()(new Request('https://gabemills.com/unrelated'),env)).status,404);
});
test('direct admin page never serves assets to visitors or non-admin accounts',async()=>{
 const local={...env,ASSETS:{fetch:()=>assert.fail('Unauthorized admin shell delivered')}};
 for(const path of ['/support/desk','/support/desk/bookmark']){
  const r=await createHandler(()=>assert.fail('Anonymous visitor needs no backend lookup'))(new Request('https://gabemills.com'+path),local);
  assert.equal(r.status,303);assert.equal(await r.text(),'');
  for(const identity of [{signedIn:true,admin:false},{signedIn:false,admin:false},{signedIn:false,admin:true},{signedIn:true,admin:'true'}]){
   const handler=createHandler(async(_,options)=>{
    assert.deepEqual(JSON.parse(options.body),{p_session:token,p_action:'session',p_data:{}});
    return Response.json(identity);
   });
   const denied=await handler(new Request('https://gabemills.com'+path,{headers:{Cookie:`__Secure-topbook-support=${token}`}}),local);
   assert.equal(denied.status,303);assert.equal(denied.headers.get('cache-control'),'no-store');
  }
 }
});
test('only a freshly verified admin session receives the bookmarked page',async()=>{
 let granted=true,served=0;
 const local={...env,ASSETS:{fetch:async()=>{served++;return new Response('Owner shell');}}};
 const handler=createHandler(async()=>Response.json({signedIn:true,admin:granted}));
 const req=()=>new Request('https://gabemills.com/support/desk/bookmark',{headers:{Cookie:`__Secure-topbook-support=${token}`}});
 const owner=await handler(req(),local);assert.equal(owner.status,200);assert.equal(await owner.text(),'Owner shell');assert.equal(owner.headers.get('cache-control'),'no-store');
 granted=false;assert.equal((await handler(req(),local)).status,303);assert.equal(served,1);
});
test('admin page authorization fails closed when session service is unavailable',async()=>{
 const handler=createHandler(async()=>{throw Error('private connection information');});
 const r=await handler(new Request('https://gabemills.com/support/desk/bookmark',{headers:{Cookie:`__Secure-topbook-support=${token}`}}),{...env,ASSETS:{fetch:()=>assert.fail('Page must remain blocked')}});
 assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private connection|Owner shell/);
});
test('support HTML fetch avoids the asset index redirect to the main website',async()=>{
 let path;
 const local={...env,ASSETS:{fetch:async(req)=>{path=new URL(req.url).pathname;return new Response('Support');}}};
 const r=await createHandler()(new Request('https://gabemills.com/support'),local);
 assert.equal(path,'/');assert.equal(r.status,200);assert.equal(r.headers.get('location'),null);
});
test('admin URL is only a page shell; it cannot grant an API session',async()=>{
 const handler=createHandler(async(_,options)=>{
  const body=JSON.parse(options.body);assert.equal(body.p_session,null);
  return Response.json({code:'28000',message:'Sign in required.'},{status:401});
 });
 const r=await handler(request({action:'inbox',admin:true,user_id:'owner'},{headers:{Referer:'https://gabemills.com/support/desk/bookmark'}}),env);
 assert.equal(r.status,401);
});
test('non-admin denial is preserved for every staff write action',async()=>{
 for(const action of ['inbox','status','visibility','request_status']){
  const handler=createHandler(async(_,options)=>{
   assert.equal(JSON.parse(options.body).p_session,token);
   return Response.json({code:'42501',message:'Admin access required.'},{status:403});
  });
  const r=await handler(request({action,data:{admin:true}},{headers:{Cookie:`__Secure-topbook-support=${token}`}}),env);
  assert.equal(r.status,403);assert.equal((await r.json()).error,'Admin access required.');
 }
});
