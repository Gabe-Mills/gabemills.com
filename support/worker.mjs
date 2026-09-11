import {canUseAdmin,isAdminPath} from './access.mjs';
import {discordAction} from './discord.mjs';
import {appleAuth} from './apple-auth.mjs';
const COOKIE='__Secure-topbook-support';
const ACTIONS=new Set(['session','logout','forum','thread','requests','request_comments','tickets','inbox','create','reply','status','visibility','report','request_comment','request_status']);
const OWNER_ACTIONS=new Set(['owner_list','owner_save','owner_move']);
const DISCORD_ACTIONS=new Set(['discord_channels','discord_messages','discord_reply','discord_edit']);
const baseHeaders={
 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'X-Frame-Options':'DENY', 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...baseHeaders,'Content-Type':'application/json',...extra}});}
function cookie(token,age){return `${COOKIE}=${token}; Max-Age=${age}; Path=/support; HttpOnly; Secure; SameSite=Strict`;}
function session(request){const value=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return /^[0-9a-f]{64}$/.test(value||'')?value:null;}
async function rpc(env,name,body,fetcher){
 const response=await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`,{
  method:'POST',headers:{'Content-Type':'application/json','apikey':env.SUPABASE_ANON_KEY,'Authorization':`Bearer ${env.SUPABASE_ANON_KEY}`},
  body:JSON.stringify(body),signal:AbortSignal.timeout(15000)
 });
 const data=await response.json();
 if(!response.ok){
  const code=data.code;const status=code==='28000'?401:code==='42501'?403:code==='P0001'?429:code==='40001'?409:code==='22023'||code==='22P02'?400:503;
  const safe=['28000','42501','P0001','22023','40001'].includes(code);
  const err=Error(safe?data.message:'Support couldn’t complete that request. Please try again.');err.status=status;throw err;
 }
 return data;
}
export function createHandler(fetcher=fetch){return async function(request,env){
 const url=new URL(request.url);
 if(url.hostname==='www.gabemills.com')return Response.redirect(`https://gabemills.com${url.pathname}${url.search}`,308);
 if(url.pathname!='/support'&&!url.pathname.startsWith('/support/'))return new Response('Not found',{status:404});
 if(url.pathname.startsWith('/support/auth/'))return appleAuth(request,env,fetcher);
 if(url.pathname.startsWith('/support/api/')){
  if(request.method!=='POST')return json({error:'Use POST.'},405,{Allow:'POST'});
  // HttpOnly cookie authentication + strict same-origin writes (including login/logout).
  if(request.headers.get('origin')!==env.SITE_ORIGIN)return json({error:'Open support on gabemills.com.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Use JSON.'},415);
  if(Number(request.headers.get('content-length')||0)>20000)return json({error:'Message too large.'},413);
  if(!env.SUPABASE_ANON_KEY)return json({error:'Support is temporarily unavailable. Please try again later.'},503);
  try {
   // Bound streamed bodies too; Content-Length is not trusted.
   const reader=request.body?.getReader();let total=0;const chunks=[];
   if(reader)while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>20000){await reader.cancel();return json({error:'Message too large.'},413);}chunks.push(value);}
   const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({error:'Invalid request.'},400);}
   if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid request.'},400);
   if(url.pathname==='/support/api/action'&&body.action==='signin_options')return json({apple:env.APPLE_WEB_ENABLED==='true'});
   if(url.pathname==='/support/api/signin'){
    if(!/^[0-9a-f]{64}$/.test(body.code||''))return json({error:'Open Support in TopBook to get a new sign-in link.'},400);
    const data=await rpc(env,'exchange_support_signin_code',{p_code:body.code},fetcher);
    if(!/^[0-9a-f]{64}$/.test(data.token||''))throw Error('Invalid session');
    return json({ok:true},200,{'Set-Cookie':cookie(data.token,Math.min(604800,Number(data.expires_in)||0))});
   }
   if(url.pathname==='/support/api/action'&&DISCORD_ACTIONS.has(body.action)){
    const token=session(request);
    const identity=await rpc(env,'support_portal',{p_session:token,p_action:'session',p_data:{}},fetcher);
    if(!canUseAdmin(identity))return json({error:'Owner access required.'},403);
    if(!body.data||typeof body.data!=='object'||Array.isArray(body.data))return json({error:'Invalid request.'},400);
    if(['discord_reply','discord_edit'].includes(body.action))await rpc(env,'support_owner_portal',{
      p_session:token,p_action:'owner_discord_audit',p_data:{operation:body.action==='discord_reply'?'reply':'edit',channel_id:body.data.channel_id,body:body.data.body}
    },fetcher);
    try{return json(await discordAction(env,body.action,body.data,fetcher));}
    catch(error){return json({error:error.status?error.message:'Couldn’t confirm delivery. Refresh Discord before sending again.'},error.status||503);}
   }
   if(url.pathname==='/support/api/action'&&OWNER_ACTIONS.has(body.action))return json(await rpc(env,'support_owner_portal',{p_session:session(request),p_action:body.action,p_data:body.data||{}},fetcher));
   if(url.pathname!=='/support/api/action'||!ACTIONS.has(body.action))return json({error:'Unknown action.'},404);
   const data=await rpc(env,'support_portal',{p_session:session(request),p_action:body.action,p_data:body.data||{}},fetcher);
   return json(data,200,body.action==='logout'?{'Set-Cookie':cookie('',0)}:{});
  }catch(error){return json({error:error.status?error.message:'Support couldn’t connect. Your message may not have sent; retrying is safe.'},error.status||503);}
 }
 if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405);
 // A bookmark is not authorization. Do not deliver the admin page shell to
 // visitors, expired sessions, regular readers, or a revoked owner role.
 if(isAdminPath(url.pathname)){
  const token=session(request);
  const deny=()=>new Response(null,{status:303,headers:{...baseHeaders,Location:'/support/sign-in','X-Robots-Tag':'noindex, nofollow'}});
  if(!token)return deny();
  if(!env.SUPABASE_ANON_KEY)return json({error:'Support is temporarily unavailable.'},503);
  try{
   const identity=await rpc(env,'support_portal',{p_session:token,p_action:'session',p_data:{}},fetcher);
   if(!canUseAdmin(identity))return deny();
  }catch{return json({error:'Support could not check access. Please try again.'},503);}
 }
 const assetURL=new URL(request.url);
 const relative=url.pathname.slice('/support'.length);
 // Assets canonicalizes /index.html to /. Ask for / directly so that internal
 // canonicalization cannot redirect /support visitors to the existing homepage.
 assetURL.pathname=relative.startsWith('/assets/')?relative:'/';
 const response=await env.ASSETS.fetch(new Request(assetURL,request));
 const headers=new Headers(response.headers);
 for(const [key,value]of Object.entries(baseHeaders))headers.set(key,value);
 if(relative.startsWith('/assets/'))headers.set('Cache-Control','public,max-age=31536000,immutable');
 if(relative.startsWith('/desk/'))headers.set('X-Robots-Tag','noindex, nofollow');
 return new Response(response.body,{status:response.status,headers});
};}
export default {fetch:createHandler()};
