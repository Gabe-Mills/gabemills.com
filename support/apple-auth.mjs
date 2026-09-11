// Server-side PKCE: Apple/Supabase credentials and tokens never reach page JS.
// Enable only after a grouped Apple web Services ID and the exact GoTrue redirect
// allowlist have been configured. Native Apple client IDs alone cannot do web OAuth.
const FLOW_COOKIE='__Secure-topbook-apple-flow';
const callback='/support/auth/callback';
const flowCookie=(value,age)=>`${FLOW_COOKIE}=${value}; Path=/support/auth; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const b64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export async function appleAuth(request,env,fetcher=fetch){
 const url=new URL(request.url);
 const failure=()=>new Response(null,{status:303,headers:{Location:'/support/sign-in?error=apple','Set-Cookie':flowCookie('',0),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 if(env.APPLE_WEB_ENABLED!=='true'||!env.SUPABASE_ANON_KEY)return failure();
 if(url.pathname==='/support/auth/apple'){
  const verifier=random(),state=random();
  const authorize=new URL(`${env.SUPABASE_URL}/auth/v1/authorize`);
  authorize.search=new URLSearchParams({provider:'apple',redirect_to:`${env.SITE_ORIGIN}${callback}?flow=${state}`,
    code_challenge:b64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),code_challenge_method:'s256'}).toString();
  return new Response(null,{status:303,headers:{Location:authorize.toString(),'Set-Cookie':flowCookie(`${Date.now()}.${state}.${verifier}`,600),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }
 if(url.pathname!==callback)return new Response('Not found',{status:404});
 const value=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(FLOW_COOKIE+'='))?.slice(FLOW_COOKIE.length+1)||'';
 const [time,state,verifier]=value.split('.');
 if(!/^\d{13}$/.test(time)||Date.now()-Number(time)>600000||Number(time)>Date.now()+5000||!/^[a-f0-9]{64}$/.test(state)||!/^[a-f0-9]{64}$/.test(verifier)||state!==url.searchParams.get('flow')||!url.searchParams.get('code')||url.searchParams.get('error'))return failure();
 const call=async(path,body,bearer=env.SUPABASE_ANON_KEY)=>{
  const r=await fetcher(`${env.SUPABASE_URL}${path}`,{method:'POST',headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Sign-in could not complete');return r.json();
 };
 try{
  const auth=await call('/auth/v1/token?grant_type=pkce',{auth_code:url.searchParams.get('code'),code_verifier:verifier});
  if(typeof auth.access_token!=='string')return failure();
  // create_support_signin_code validates the verified Supabase auth.uid server-side.
  // No identity data from Apple query parameters or user-editable profile fields.
  const code=await call('/rest/v1/rpc/create_support_signin_code',{},auth.access_token);
  const session=await call('/rest/v1/rpc/exchange_support_signin_code',{p_code:code.code});
  if(!/^[a-f0-9]{64}$/.test(session.token||''))return failure();
  const headers=new Headers({'Location':'/support?signin=complete','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  headers.append('Set-Cookie',flowCookie('',0));
  headers.append('Set-Cookie',`__Secure-topbook-support=${session.token}; Path=/support; Max-Age=604800; HttpOnly; Secure; SameSite=Strict`);
  return new Response(null,{status:303,headers});
 }catch{return failure();}
}
