import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../worker.mjs';
import {discordAction,allowedSupportChannel} from '../discord.mjs';
import {appleAuth} from '../apple-auth.mjs';
const token='a'.repeat(64);
const env={SITE_ORIGIN:'https://gabemills.com',SUPABASE_URL:'https://backend.example',SUPABASE_ANON_KEY:'anon',DISCORD_BOT_TOKEN:'never-browser',DISCORD_GUILD_ID:'11111111111111111',DISCORD_SUPPORT_CHANNEL:'22222222222222222',DISCORD_TICKETS_CATEGORY:'33333333333333333',DISCORD_TICKET_PANEL:'44444444444444444',DISCORD_BOT_ID:'55555555555555555'};
const req=(action,data={})=>new Request('https://gabemills.com/support/api/action',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json',Cookie:`__Secure-topbook-support=${token}`},body:JSON.stringify({action,data})});
test('every owner action uses session-validated owner RPC, never supplied user claims',async()=>{
 for(const action of ['owner_list','owner_save','owner_move']){
  const handler=createHandler(async(url,options)=>{assert.ok(url.endsWith('/support_owner_portal'));assert.equal(JSON.parse(options.body).p_session,token);return Response.json({code:'42501',message:'Owner access required.'},{status:403});});
  assert.equal((await handler(req(action,{admin:true,user_id:'Gabe'}),env)).status,403);
 }
});
test('all Discord actions stop before Discord for reader, revoked, expired and forged owners',async()=>{
 for(const action of ['discord_channels','discord_messages','discord_reply','discord_edit'])for(const identity of [{signedIn:true,admin:false},{signedIn:false,admin:true},{signedIn:true,admin:'true'}]){
  let calls=0;const handler=createHandler(async(url)=>{calls++;assert.ok(url.endsWith('/support_portal'));return Response.json(identity);});
  const r=await handler(req(action,{admin:true}),env);assert.equal(r.status,403);assert.equal(calls,1);assert.doesNotMatch(await r.text(),/never-browser/);
 }
});
test('stale edit gets a useful conflict response, not a silent overwrite',async()=>{
 const handler=createHandler(async()=>Response.json({code:'40001',message:'This item changed. Refresh before saving again.'},{status:409}));
 const r=await handler(req('owner_save'),env);assert.equal(r.status,409);assert.match((await r.json()).error,/Refresh/);
});
test('Discord only permits exact support channel or ticket category within this guild',()=>{
 const c={id:env.DISCORD_SUPPORT_CHANNEL,guild_id:env.DISCORD_GUILD_ID,type:0};
 assert.equal(allowedSupportChannel(c,env),true);
 for(const other of [{...c,guild_id:'other'},{...c,type:1},{...c,id:env.DISCORD_TICKET_PANEL,parent_id:env.DISCORD_TICKETS_CATEGORY},{...c,id:'66666666666666666',parent_id:'other'}])assert.equal(allowedSupportChannel(other,env),false);
 assert.equal(allowedSupportChannel({...c,id:'66666666666666666',parent_id:env.DISCORD_TICKETS_CATEGORY},env),true);
});
test('Discord blocks arbitrary paths and moved channels before reading messages',async()=>{
 await assert.rejects(()=>discordAction(env,'discord_messages',{channel_id:'../guilds'},()=>assert.fail()),/Choose/);
 let calls=0;
 await assert.rejects(()=>discordAction(env,'discord_messages',{channel_id:'66666666666666666'},async()=>{calls++;return Response.json({id:'66666666666666666',guild_id:env.DISCORD_GUILD_ID,type:0,parent_id:'other'});}),/not in/);
 assert.equal(calls,1);
});
test('Discord sends as bot without pings and with retry nonce',async()=>{
 const channel={id:env.DISCORD_SUPPORT_CHANNEL,guild_id:env.DISCORD_GUILD_ID,type:0};let sent;
 const result=await discordAction(env,'discord_reply',{channel_id:channel.id,body:'Hello @everyone',client_id:'12345678-1234-1234-1234-123456789abc'},async(url,options)=>{
  assert.ok(url.startsWith('https://discord.com/api/v10/'));
  if(options.method==='GET')return Response.json(channel);
  sent=JSON.parse(options.body);return Response.json({id:'66666666666666666'});
 });
 assert.deepEqual(sent.allowed_mentions,{parse:[],replied_user:false});assert.equal(sent.enforce_nonce,true);assert.ok(sent.nonce.length<=25);assert.deepEqual(result,{id:'66666666666666666'});
});
test('Discord cannot impersonate or edit another author or overwrite a changed message',async()=>{
 for(const old of [{author:{id:'someone'},content:'old'},{author:{id:env.DISCORD_BOT_ID},content:'changed'}]){
  let calls=0;await assert.rejects(()=>discordAction(env,'discord_edit',{channel_id:env.DISCORD_SUPPORT_CHANNEL,message_id:'66666666666666666',body:'new',original_body:'old'},async()=>Response.json(++calls===1?{id:env.DISCORD_SUPPORT_CHANNEL,guild_id:env.DISCORD_GUILD_ID,type:0}:old)),/Only|changed/);
  assert.equal(calls,2);
 }
});
test('Discord content projection does not expose raw user/account data or arbitrary attachment URLs',async()=>{
 let calls=0;const result=await discordAction(env,'discord_messages',{channel_id:env.DISCORD_SUPPORT_CHANNEL},async()=>Response.json(++calls===1?{id:env.DISCORD_SUPPORT_CHANNEL,guild_id:env.DISCORD_GUILD_ID,type:0}:[{id:'66666666666666666',content:'<script>bad()</script>',author:{id:'privateid',email:'private@example.test',username:'Reader'},timestamp:'2026-09-08',attachments:[{url:'javascript:bad'}]}]));
 const text=JSON.stringify(result);assert.doesNotMatch(text,/privateid|private@example|javascript:/);assert.equal(result[0].attachments,1);assert.equal(result[0].body,'<script>bad()</script>');
});
test('Apple browser flow is disabled until actual Services ID configuration is ready',async()=>{
 const result=await appleAuth(new Request('https://gabemills.com/support/auth/apple'),env,()=>assert.fail());
 assert.equal(result.status,303);assert.match(result.headers.get('location'),/sign-in\?error=apple/);
});
test('Apple PKCE binds callback to same-browser short-lived verifier; invalid callbacks never touch auth',async()=>{
 const enabled={...env,APPLE_WEB_ENABLED:'true'};
 const start=await appleAuth(new Request('https://gabemills.com/support/auth/apple'),enabled);
 const dest=new URL(start.headers.get('location'));assert.equal(dest.origin,'https://backend.example');assert.equal(dest.searchParams.get('code_challenge_method'),'s256');
 const cookie=start.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);assert.doesNotMatch(dest.toString(),/never-browser/);
 for(const url of ['https://gabemills.com/support/auth/callback?code=x','https://gabemills.com/support/auth/callback?code=x&flow=bad'])assert.equal((await appleAuth(new Request(url,{headers:{cookie}}),enabled,()=>assert.fail())).status,303);
});
test('Apple successful callback keeps auth JWTs out of browser and issues only the scoped support cookie',async()=>{
 const enabled={...env,APPLE_WEB_ENABLED:'true'};
 const start=await appleAuth(new Request('https://gabemills.com/support/auth/apple'),enabled);
 const dest=new URL(start.headers.get('location')),url=new URL(dest.searchParams.get('redirect_to'));url.searchParams.set('code','verified-code');
 let calls=0;const response=await appleAuth(new Request(url,{headers:{cookie:start.headers.get('set-cookie')}}),enabled,async(path,options)=>{
  calls++;if(calls===1){assert.match(path,/grant_type=pkce/);assert.ok(JSON.parse(options.body).code_verifier);return Response.json({access_token:'secret-jwt'});}
  if(calls===2){assert.match(path,/create_support_signin_code/);assert.equal(options.headers.Authorization,'Bearer secret-jwt');return Response.json({code:'b'.repeat(64)});}
  return Response.json({token,expires_in:604800});
 });
 assert.equal(calls,3);assert.equal(response.status,303);assert.equal(await response.text(),'');assert.doesNotMatch(JSON.stringify([...response.headers]),/secret-jwt/);assert.match(response.headers.get('set-cookie'),/SameSite=Strict/);
});
