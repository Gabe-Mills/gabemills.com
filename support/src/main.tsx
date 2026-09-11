import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {api,signin,Session,Thread,Conversation,Idea,Message,statusName,dateLabel} from './api';
import './support.css';
import {createActionGate} from './actionGate';
import {canUseAdmin,isAdminPath} from '../access.mjs';
import {OwnerDesk} from './OwnerDesk';

type Tab='help'|'forum'|'tickets'|'requests'|'inbox';
const EMPTY_SESSION:Session={signedIn:false,admin:false,name:null};
let requestListCache:Idea[]|undefined;
const requestMessageCache=new Map<string,Message[]>();
const help=[
 {title:'Membership & billing',question:'How do I cancel or restore?',answer:'Apple handles billing. In TopBook, open You → TopBook+ → Manage with Apple. Canceling renewal keeps access until the paid period ends. Restore checks an existing purchase; it does not buy another one. If you deleted your TopBook account, don’t pay again to fix an account link.',category:'billing'},
 {title:'Scans & book details',question:'Why is a book unrated?',answer:'TopBook combines available book information, public review mentions and reader contributions. Missing ratings mean we don’t have enough evidence—not that a book is free of that content. Send the title or ISBN when asking us to check a result.',category:'scanning'},
 {title:'Sign-in & your library',question:'Where are my saved books?',answer:'Check You → Account to confirm you’re signed in with the same TopBook account on each device. Keep the app online while it syncs. Deleting an account removes synced data and does not cancel Apple subscriptions.',category:'account'}
];
function App(){
 const [session,setSession]=useState<Session>(EMPTY_SESSION);
 const [checking,setChecking]=useState(true),[error,setError]=useState<string>();
 const [tab,setTab]=useState<Tab>(isAdminPath(location.pathname)?'inbox':'help');
 const [view,setView]=useState<{kind:'thread'|'request';id:string;idea?:Idea}>();
 const [compose,setCompose]=useState<'public'|'private'>();
 const [category,setCategory]=useState('other');
 const [epoch,setEpoch]=useState(0);
 const [ownerSection,setOwnerSection]=useState<'inbox'|'requests'|'reviews'|'discord'>('inbox');
 const [showSignIn,setShowSignIn]=useState(location.pathname==='/support/sign-in');
 const current=useRef(0);
 useEffect(()=>{
  const code=new URLSearchParams(location.hash.slice(1)).get('signin');
  if(location.hash)history.replaceState(null,'',location.pathname);
  const attempt=++current.current;
  (async()=>{try{if(code)await signin(code);const s=await api<Session>('session');if(attempt===current.current){setSession(s);if(s.signedIn){setShowSignIn(false);if(canUseAdmin(s)&&(code||location.search.includes('signin=complete'))){setTab('inbox');history.replaceState(null,'','/support/desk');}}if(!canUseAdmin(s)&&isAdminPath(location.pathname)){setTab('help');history.replaceState(null,'','/support');}}}catch(e){if(attempt===current.current)setError((e as Error).message);}finally{if(attempt===current.current)setChecking(false);}})();
 },[]);
 const admin=canUseAdmin(session);
 useEffect(()=>{
  if(!session.signedIn)return;
  let alive=true;
  const recheck=async()=>{const attempt=current.current;try{const next=await api<Session>('session');if(!alive||attempt!==current.current)return;setSession(next);if(!next.signedIn||(admin&&!canUseAdmin(next))){setView(undefined);setCompose(undefined);setTab('help');setError('Your support access changed. Sign in again.');}}catch{/* A transient outage is not a new identity. Every write still checks access. */}};
  const visible=()=>{if(document.visibilityState==='visible')void recheck();};
  window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  const timer=window.setInterval(visible,60000);
  return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[session.signedIn,admin]);
 const navigate=(next:Tab)=>{setShowSignIn(false);setTab(next==='inbox'&&!admin?'help':next);setView(undefined);setCompose(undefined);setError(undefined);};
 const start=(scope:'public'|'private',topic='other')=>{setCategory(topic);setCompose(scope);setView(undefined);setTab(scope==='private'?'tickets':'forum');};
 const signOut=async()=>{try{await api('logout');current.current++;setSession(EMPTY_SESSION);navigate('help');}catch(e){setError((e as Error).message);}};
 const nav:[Tab,string][]=[['help','Help'],['forum','Forum'],['tickets','Messages'],['requests','Ideas']];
 return <div className="support-app">
  <a className="skip-link" href="#main">Skip to content</a>
  <header className="site-header">
   <a className="wordmark" href="/support" aria-label="TopBook support home"><SupportIcon name="book"/><span>TopBook</span><span className="wordmark-sub">Support</span></a>
   <div className="header-account">
    {admin&&tab==='inbox'&&<button className="text-button public-support-link" onClick={()=>navigate('help')}>Public support</button>}
    {session.signedIn&&<>{!admin&&<span className="account-name">{session.name||'Reader'}</span>}<button className="button secondary compact-button" onClick={signOut}>Sign out</button></>}
   </div>
  </header>
  {!(admin&&tab==='inbox')&&<><nav className="main-nav" aria-label="Support sections">{nav.map(([key,label])=><button key={key} className={tab===key?'nav-link selected':'nav-link'} aria-current={tab===key?'page':undefined} onClick={()=>navigate(key)}><SupportIcon name={key==='help'?'help':key==='forum'?'community':key==='tickets'?'message':'idea'}/><span>{label}</span></button>)}</nav><AdminBar session={session} selected={false} open={()=>navigate('inbox')}/></>}
  <main id="main" tabIndex={-1} className={'main-pane '+(tab==='inbox'&&admin?'desk-pane':'')}>
   {error&&<div role="alert" className="notice error"><span>{error} <button className="retry-button" onClick={()=>location.reload()}>Try again</button></span><button onClick={()=>setError(undefined)} aria-label="Dismiss error">×</button></div>}
   {showSignIn?<SignInPrompt/>:view?<ConversationPane key={view.id} view={view} session={session} back={()=>{setView(undefined);setEpoch(x=>x+1);}}/>:
    compose?<Composer scope={compose} category={category} session={session} cancel={()=>setCompose(undefined)} saved={id=>{setCompose(undefined);setView({kind:'thread',id});setEpoch(x=>x+1);}}/>:
    tab==='help'?<Help start={start} community={()=>navigate('forum')}/>:
    tab==='requests'?<Requests key={epoch} open={idea=>setView({kind:'request',id:idea.id,idea})}/>:
    tab==='inbox'&&admin?<OwnerDesk session={session} section={ownerSection} setSection={setOwnerSection} open={setView} onAccessLost={()=>{setSession(EMPTY_SESSION);setView(undefined);setTab('help');setError('Your owner session ended. Sign in again.');}} inbox={<ThreadList key={epoch} tab="inbox" session={session} open={id=>setView({kind:'thread',id})} start={start}/>}/>:
    tab==='inbox'&&!admin?(checking?<p role="status">Loading support…</p>:<Help start={start} community={()=>navigate('forum')}/>):
    <ThreadList key={`${tab}-${epoch}`} tab={tab as 'forum'|'tickets'|'inbox'} session={session} open={id=>setView({kind:'thread',id})} start={start}/>
   }
  </main>
  <footer className="site-footer"><span>TopBook support</span><div><a href="https://booksearcher-api.gabemills.com/functions/v1/legal/privacy">Privacy</a><a href="https://booksearcher-api.gabemills.com/functions/v1/legal/terms">Terms</a><a href="/">gabemills.com ↗</a></div></footer>
 </div>;
}
export function AdminBar({session,selected,open}:{session:Session;selected:boolean;open:()=>void}){
 if(!canUseAdmin(session))return null;
 return <div className="owner-bar"><span className="owner-name">{session.name||'Owner'} · Admin</span><button className={selected?'admin-link selected':'admin-link'} aria-current={selected?'page':undefined} onClick={open}>Admin inbox <SupportIcon name="arrow"/></button></div>;
}
function SupportIcon({name}:{name:'book'|'message'|'community'|'arrow'|'help'|'idea'}){
 const paths={book:'M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z',message:'M5 18 2 22V5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5Zm2-10h10M7 12h7',community:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',arrow:'m9 5 7 7-7 7',help:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01',idea:'M9 18h6M10 22h4M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z'};
 return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
function PageTitle({eyebrow,title,subtitle}:{eyebrow:string;title:string;subtitle:string}){return <div className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">{subtitle}</p></div>;}
function SignInPrompt(){const [apple,setApple]=useState(false);useEffect(()=>{let alive=true;api<{apple:boolean}>('signin_options').then(r=>{if(alive)setApple(r.apple===true);}).catch(()=>{});return()=>{alive=false;};},[]);return <div className="signin-prompt"><SupportIcon name="book"/><div><h2>Sign in to TopBook</h2>{apple&&<><a className="button primary apple-signin" href="/support/auth/apple">Continue with Apple</a><p className="fine-print">Or sign in from the app below.</p></>}{location.search.includes('error=apple')&&<p role="alert" className="notice error">Apple sign-in couldn’t finish. Try again, or open support from TopBook.</p>}<p>In the app, open <strong>You → Help & support → Open help center</strong>.</p><details><summary>Using another device?</summary><p>Copy a private sign-in link from the app’s support screen. Open it in your own browser within 5 minutes. Don’t share it.</p></details></div></div>;}
export function Help({start,community}:{start:(scope:'public'|'private',category?:string)=>void;community:()=>void}){
 const [answer,setAnswer]=useState<number>();
 return <div className="help-home">
  <div className="help-heading"><h1>How can we help?</h1><p>Find an answer. Or ask us directly.</p></div>
  <section className="helper-card" aria-label="Quick answers">
   <div className="helper-top"><h2 className="helper-label">Quick answers</h2></div>
   <div className="quick-questions">{help.map((h,i)=><button key={h.title} aria-expanded={answer===i} aria-controls="quick-answer" onClick={()=>setAnswer(answer===i?undefined:i)}>{['Membership','Scanning','Account'][i]}</button>)}</div>
   {answer!==undefined&&<div id="quick-answer" className="helper-answer" role="status"><h2>{help[answer].question}</h2><p>{help[answer].answer}</p><button className="text-button" onClick={()=>start('private',help[answer].category)}>Talk to a human <span aria-hidden="true">→</span></button></div>}
  </section>
  <div className="help-options">
   <button onClick={()=>start('private')} className="option-row contact-option"><span className="option-icon"><SupportIcon name="message"/></span><span className="option-copy"><strong>Talk to a human</strong><span>Start a private message</span></span><SupportIcon name="arrow"/></button>
   <button onClick={community} className="option-row"><span className="option-icon"><SupportIcon name="community"/></span><span className="option-copy"><strong>Browse community</strong><span>Public questions and discussions</span></span><SupportIcon name="arrow"/></button>
  </div>
  <p className="availability">Not live chat. Check Messages for replies.</p>
 </div>;
}
function ThreadList({tab,session,open,start}:{tab:'forum'|'tickets'|'inbox';session:Session;open:(id:string)=>void;start:(scope:'public'|'private')=>void}){
 const [rows,setRows]=useState<Thread[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string>(),[filter,setFilter]=useState(''),[more,setMore]=useState(false);
 const generation=useRef(0);const load=useCallback(async(append=false)=>{const g=++generation.current;setLoading(true);setError(undefined);try{const next=await api<Thread[]>(tab,{...(filter?{status:filter}:{}),offset:append?rows.length:0});if(g!==generation.current)return;setRows(old=>append?[...old,...next]:next);setMore(next.length===50);}catch(e){if(g===generation.current)setError((e as Error).message);}finally{if(g===generation.current)setLoading(false);}},[tab,filter,rows.length]);
 useEffect(()=>{void load();return()=>{generation.current++;};},[tab,filter,session.signedIn]);
 const publicPage=tab==='forum';
 return <><PageTitle eyebrow={publicPage?'Public forum':tab==='inbox'?'Owner workspace':'Private support'} title={publicPage?'Community':tab==='inbox'?'Support inbox':'Your messages'} subtitle={publicPage?'Ask a question or share a book.':tab==='inbox'?'Reply to readers and keep things moving.':'Private conversations with TopBook support.'}/>
 {!publicPage&&!session.signedIn?<SignInPrompt/>:<><div className="list-toolbar"><div className="filter-row"><label className="sr-only" htmlFor="status-filter">Filter status</label><select id="status-filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All statuses</option>{['open','in_progress','waiting_on_reader','resolved'].map(s=><option key={s} value={s}>{statusName(s)}</option>)}</select><button className="text-button" onClick={()=>load()} disabled={loading}>Refresh</button></div><button className="button primary" onClick={()=>start(publicPage?'public':'private')}>{publicPage?'New discussion':'New conversation'}</button></div>
 {error&&<p className="notice error" role="alert">{error}</p>}{loading&&!rows.length?<p role="status" className="empty">Loading conversations…</p>:!rows.length&&!error?<div className="empty"><h2>{publicPage?'Start a thoughtful conversation.':'Nothing here yet.'}</h2><p>{publicPage?'The first question could be yours.':'New conversations and replies will appear here.'}</p></div>:<div className="thread-list">{rows.map(t=><button key={t.id} className="thread-row" onClick={()=>open(t.id)}><div><div className="thread-meta"><span className={'pill '+(t.scope==='private'?'private':'')}>{t.scope==='private'?'Private':'Public'}</span>{t.hidden&&<span className="pill warning">Hidden</span>}{t.flags>0&&<span className="pill warning">{t.flags} reports</span>}<span>{dateLabel(t.updated_at)}</span></div><h2>{t.title}</h2><p>{t.author} · {t.messages} {t.messages===1?'message':'messages'}</p></div><div className="row-end"><span className="status-pill">{statusName(t.status)}</span><span aria-hidden="true">→</span></div></button>)}</div>}{more&&<button className="button secondary" disabled={loading} onClick={()=>load(true)}>Load more</button>}</>}
 </>;
}
function Composer({scope,category,session,cancel,saved}:{scope:'public'|'private';category:string;session:Session;cancel:()=>void;saved:(id:string)=>void}){
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[topic,setTopic]=useState(category),[busy,setBusy]=useState(false),[error,setError]=useState<string>();const cid=useRef(crypto.randomUUID());
 const gate=useRef(createActionGate()).current;
 useEffect(()=>()=>gate.invalidate(),[gate]);
 async function submit(e:React.FormEvent){e.preventDefault();const attempt=gate.begin();if(attempt===null)return;setBusy(true);setError(undefined);try{const r=await api<{id:string}>('create',{scope,title,body,category:topic,client_id:cid.current});if(gate.isCurrent(attempt))saved(r.id);}catch(e){if(gate.isCurrent(attempt))setError((e as Error).message);}finally{if(gate.finish(attempt))setBusy(false);}}
 return <><button className="back" onClick={cancel}>← Back</button><PageTitle eyebrow={scope==='private'?'Only you + TopBook support':'Public forum'} title={scope==='private'?'New private message':'New community post'} subtitle={scope==='private'?'Only you and support can read this. Don’t include passwords or payment details.':'Everyone can read this. Keep account and payment details private.'}/>{!session.signedIn?<SignInPrompt/>:<form className="compose-form" onSubmit={submit}>
 <label htmlFor="topic">Topic</label><select id="topic" disabled={busy} value={topic} onChange={e=>setTopic(e.target.value)}><option value="other">General question</option><option value="scanning">Scans & books</option><option value="billing">Membership & billing</option><option value="account">Account & sync</option></select>
 <label htmlFor="title">A short title</label><input id="title" disabled={busy} value={title} onChange={e=>setTitle(e.target.value)} minLength={3} maxLength={120} required placeholder="What do you need help with?"/>
 <label htmlFor="message">Your message</label><textarea id="message" disabled={busy} rows={7} value={body} onChange={e=>setBody(e.target.value)} minLength={10} maxLength={4000} required placeholder="A few details help us understand…"/>
 <span className="fine-print">{body.length.toLocaleString()} / 4,000 characters</span>{error&&<p role="alert" className="notice error">{error}</p>}
 <div className="form-actions"><button className="button primary" disabled={busy}>{busy?'Sending…':scope==='private'?'Send private message':'Publish discussion'}</button><button type="button" className="text-button" onClick={cancel}>Cancel</button></div><p className="fine-print">{scope==='private'?'Check Messages for replies.':'By posting, you agree to keep it respectful. Public posts can be reported and moderated.'}</p></form>}</>;
}
function Requests({open}:{open:(idea:Idea)=>void}){
 const [rows,setRows]=useState<Idea[]>(()=>requestListCache||[]),[error,setError]=useState<string>(),[loading,setLoading]=useState(!requestListCache),[more,setMore]=useState(false);
 const generation=useRef(0);
 const load=async(append=false)=>{const g=++generation.current;setLoading(true);try{const r=await api<Idea[]>('requests',{offset:append?rows.length:0});if(g!==generation.current)return;setRows(old=>{const next=append?[...old,...r]:r;requestListCache=next;return next;});setMore(r.length===50);setError(undefined);}catch(e){if(g===generation.current)setError((e as Error).message);}finally{if(g===generation.current)setLoading(false);}};
 useEffect(()=>{void load();},[]);
 return <><PageTitle eyebrow="The same board as the app" title="Ideas for TopBook" subtitle="Suggest and vote in the app. Official updates appear here."/>{error&&<p className="notice error" role="alert">{error}</p>}<div className="list-toolbar"><span className="muted">Public requests</span><button className="text-button" onClick={()=>load()} disabled={loading}>{loading&&rows.length?'Updating…':'Refresh'}</button></div>{!rows.length?<div className="empty">{loading?'Loading ideas…':error?'Try Refresh when you’re connected.':'No public ideas yet. Add one in the TopBook app.'}</div>:<div className="thread-list request-list">{rows.map(r=><RequestRow key={r.id} idea={r} open={open}/>)}</div>}{more&&<button className="button secondary" disabled={loading} onClick={()=>load(true)}>Load more</button>}</>;
}
export function RequestRow({idea,open}:{idea:Idea;open:(idea:Idea)=>void}){return <button className="thread-row request-row" onClick={()=>open(idea)}><div><span className="eyebrow">{idea.vote_count} votes · {idea.comment_count} updates</span><h2>{idea.title}</h2><p className="request-copy">{idea.body}</p></div><span className="status-pill">{statusName(idea.status)}</span></button>}
export function RequestReplyNotice(){return <div className="official-note"><strong>Official updates</strong><span>Only TopBook support can reply to public requests. Readers can suggest and vote in the app.</span></div>}
function ConversationPane({view,session,back}:{view:{kind:'thread'|'request';id:string;idea?:Idea};session:Session;back:()=>void}){
 const [conversation,setConversation]=useState<Conversation>(),[messages,setMessages]=useState<Message[]>(()=>view.kind==='request'?requestMessageCache.get(view.id)||[]:[]),[body,setBody]=useState(''),[internal,setInternal]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string>(),[notice,setNotice]=useState<string>(),[requestStatus,setRequestStatus]=useState(view.idea?.status||'open'),[more,setMore]=useState(false);
 const cid=useRef(crypto.randomUUID()),alive=useRef(true),requestNumber=useRef(0);
 const gate=useRef(createActionGate()).current;
 useEffect(()=>()=>gate.invalidate(),[gate]);
 const load=useCallback(async(append=false)=>{const n=++requestNumber.current;try{if(view.kind==='request'){const r=await api<Message[]>('request_comments',{id:view.id,offset:append?messages.length:0});if(!alive.current||n!==requestNumber.current)return;setMessages(old=>{const next=append?[...old,...r]:r;requestMessageCache.set(view.id,next);return next;});setMore(r.length===100);}else{const r=await api<Conversation>('thread',{id:view.id,offset:append?messages.length:0});if(!alive.current||n!==requestNumber.current)return;setConversation(r);setMessages(old=>append?[...old,...r.messages]:r.messages);setMore(r.messages.length===100);}setError(undefined);}catch(e){if(alive.current&&n===requestNumber.current)setError((e as Error).message);}},[view.id,view.kind,messages.length]);
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;requestNumber.current++;};},[view.id]);
 async function send(e:React.FormEvent){e.preventDefault();const attempt=gate.begin();if(attempt===null)return;setBusy(true);setError(undefined);try{await api(view.kind==='request'?'request_comment':'reply',{id:view.id,body,internal,client_id:cid.current});if(!gate.isCurrent(attempt))return;setBody('');cid.current=crypto.randomUUID();setNotice(internal?'Private staff note saved.':'Message sent.');await load();}catch(e){if(gate.isCurrent(attempt))setError((e as Error).message);}finally{if(gate.finish(attempt))setBusy(false);}}
 async function change(action:string,data:unknown){const attempt=gate.begin();if(attempt===null)return;setBusy(true);setError(undefined);try{await api(action,{id:view.id,...data as object});if(!gate.isCurrent(attempt))return;if(action==='request_status')setRequestStatus((data as {status:string}).status);setNotice('Saved.');await load();}catch(e){if(gate.isCurrent(attempt))setError((e as Error).message);}finally{if(gate.finish(attempt))setBusy(false);}}
 const isPrivate=conversation?.scope==='private',admin=canUseAdmin(session);
 return <><button className="back" onClick={back}>← Back to {view.kind==='request'?'requests':'conversations'}</button><div className="conversation-heading"><p className="eyebrow">{view.kind==='request'?'Public request':conversation?isPrivate?'Private conversation · you + support':'Public discussion':'Conversation'}</p><h1>{conversation?.title||view.idea?.title||'Loading…'}</h1><span className="status-pill">{statusName(conversation?.status||requestStatus)}</span>{view.idea&&<p className="message-body lede">{view.idea.body}</p>}</div>
 {admin&&<section className="admin-controls" aria-label="Admin actions"><label htmlFor="ticket-status">Move to</label><select id="ticket-status" disabled={busy} value={view.kind==='request'?requestStatus:conversation?.status||'open'} onChange={e=>change(view.kind==='request'?'request_status':'status',{status:e.target.value})}>{(view.kind==='request'?['open','planned','in_progress','shipped']:['open','in_progress','waiting_on_reader','resolved']).map(s=><option key={s} value={s}>{statusName(s)}</option>)}</select>{conversation?.scope==='public'&&<button className="text-button" disabled={busy} onClick={()=>change('visibility',{hidden:!conversation.hidden})}>{conversation.hidden?'Restore public post':'Hide public post'}</button>}</section>}
 {error&&<p className="notice error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 <div className="conversation-toolbar"><span className="muted">{isPrivate?'Replies appear here. Check back for an answer.':'Keep the conversation respectful.'}</span><button className="text-button" onClick={()=>load()}>Check for replies</button></div>
 <div className="messages">{messages.map(m=><article key={m.id} className={'message '+(m.staff?'staff-message ':'')+(m.internal?'internal-note':'')}><div className="message-meta"><strong>{m.author||m.author_name||'Reader'}</strong>{m.staff&&<span className="staff-badge">TopBook support</span>}{m.internal&&<span className="pill warning">Private staff note</span>}<time dateTime={m.created_at}>{dateLabel(m.created_at)}</time></div><p className="message-body">{m.body}</p></article>)}</div>{more&&<button className="button secondary" onClick={()=>load(true)}>Load more messages</button>}
 {view.kind==='request'&&!admin?<RequestReplyNotice/>:session.signedIn?<form className="reply-form" onSubmit={send}><label htmlFor="reply">{view.kind==='request'?'Official update':internal?'Private staff note':'Your reply'}</label><textarea id="reply" disabled={busy} rows={4} value={body} onChange={e=>setBody(e.target.value)} required maxLength={view.kind==='request'?800:4000} placeholder={view.kind==='request'?'Write an official update…':'Write a reply…'}/>{admin&&view.kind==='thread'&&<label className="checkbox-label"><input type="checkbox" disabled={busy} checked={internal} onChange={e=>setInternal(e.target.checked)}/>Staff-only note — hidden from readers</label>}<button className="button primary" disabled={busy||!body.trim()}>{busy?'Saving…':view.kind==='request'?'Publish update':internal?'Save private note':'Send reply'}</button></form>:<SignInPrompt/>}
 {session.signedIn&&conversation?.scope==='public'&&!admin&&<details className="report"><summary>Report this discussion</summary><p>Flag spam, harassment or inappropriate content for review.</p><button className="text-button" disabled={busy} onClick={()=>change('report',{reason:'other'})}>Send report to TopBook</button></details>}
 </>;
}
// No StrictMode double-execution of the single-use sign-in exchange.
if(typeof document!=='undefined')createRoot(document.getElementById('root')!).render(<App/>);
