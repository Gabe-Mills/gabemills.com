import React,{useCallback,useEffect,useRef,useState} from 'react';
import {api,ApiError,Idea,Session,statusName,dateLabel} from './api';
import {canUseAdmin} from '../access.mjs';
import {createActionGate} from './actionGate';
import './owner.css';

type Section='inbox'|'requests'|'reviews'|'discord';
export type OwnerItem={id:string;title:string;body:string;headline?:string;status?:string;visibility:string;author:string;rating?:number;vote_count?:number;comment_count?:number;flags?:number;revision:string;created_at:string};
type Open=(view:{kind:'request'|'thread';id:string;idea?:Idea})=>void;
const visibilityName=(value:string)=>({published:'Visible',hidden:'Hidden',removed:'In trash'}[value]||value);

export function OwnerDesk({session,section,setSection,inbox,open,onAccessLost}:{session:Session;section:Section;setSection:(section:Section)=>void;inbox:React.ReactNode;open:Open;onAccessLost:()=>void}){
 if(!canUseAdmin(session))return null;
 return <section className="owner-desk" aria-label="Owner workspace">
  <div className="desk-heading"><div><p className="eyebrow">OWNER WORKSPACE · {session.name||'Owner'}</p><h1>Your desk.</h1></div><span className="owner-verified">✓ Owner verified</span></div>
  <nav className="desk-tabs" aria-label="Owner tools">{(['inbox','requests','reviews','discord'] as Section[]).map(key=><button key={key} aria-current={section===key?'page':undefined} className={section===key?'selected':''} onClick={()=>setSection(key)}>{({inbox:'Inbox',requests:'Requests',reviews:'Reviews',discord:'Discord'})[key]}</button>)}</nav>
  {section==='inbox'?<div className="owner-inbox">{inbox}</div>:section==='discord'?<DiscordDesk onAccessLost={onAccessLost}/>:<OwnerQueue key={section} kind={section} open={open} onAccessLost={onAccessLost}/>}
 </section>;
}

function OwnerQueue({kind,open,onAccessLost}:{kind:'requests'|'reviews';open:Open;onAccessLost:()=>void}){
 const [items,setItems]=useState<OwnerItem[]>([]),[filter,setFilter]=useState('published'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[edit,setEdit]=useState<OwnerItem>(),[more,setMore]=useState(false);
 const generation=useRef(0),gate=useRef(createActionGate()).current;
 const failure=(e:unknown)=>{if(e instanceof ApiError&&[401,403].includes(e.status)){setItems([]);setEdit(undefined);onAccessLost();}else setError((e as Error).message);};
 const load=useCallback(async(append=false)=>{const g=++generation.current;setLoading(true);setError('');try{const result=await api<OwnerItem[]>('owner_list',{kind,visibility:filter,offset:append?items.length:0});if(g!==generation.current)return;setItems(old=>append?[...old,...result.filter(r=>!old.some(o=>o.id===r.id))]:result);setMore(result.length===50);}catch(e){if(g===generation.current)failure(e);}finally{if(g===generation.current)setLoading(false);}},[kind,filter,items.length]);
 useEffect(()=>{void load();return()=>{generation.current++;};},[kind,filter]);
 useEffect(()=>()=>gate.invalidate(),[gate]);
 const move=async(item:OwnerItem,target:OwnerItem)=>{const attempt=gate.begin();if(attempt===null)return;setBusy(true);setNotice('');try{await api('owner_move',{id:item.id,target_id:target.id,direction:items.indexOf(item)>items.indexOf(target)?'up':'down'});if(!gate.isCurrent(attempt))return;setNotice('Queue order saved. Reader votes stay unchanged.');await load();}catch(e){if(gate.isCurrent(attempt))failure(e);}finally{if(gate.finish(attempt))setBusy(false);}};
 return <>
  <div className="desk-toolbar"><div><h2>{kind==='requests'?'Requests':'Reader reviews'}</h2><p className="muted">{kind==='requests'?'Your queue order · reader voting stays unchanged':'Keep reader voices. Hide content that breaks the rules.'}</p></div><button className="button secondary compact-button" disabled={loading||busy} onClick={()=>load()}>Refresh</button></div>
  <div className="queue-filters" aria-label="Visibility">{[['published','Visible'],['hidden','Hidden'],['removed','Trash'],['all','All']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>{setFilter(key);setNotice('');}}>{label}</button>)}</div>
  {error&&<p role="alert" className="notice error">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
  {loading&&!items.length?<p role="status" className="empty">Loading {kind}…</p>:!items.length&&!error?<div className="empty"><h2>All clear.</h2><p>No {kind} in this view.</p></div>:<div className="owner-queue">{items.map((item,index)=><OwnerRow key={item.id} item={item} kind={kind} disabled={busy||loading} edit={()=>setEdit(item)} open={()=>open({kind:'request',id:item.id,idea:{...item,author_name:item.author,status:item.status||'open',vote_count:item.vote_count||0,comment_count:item.comment_count||0}})} up={index>0?()=>move(item,items[index-1]):undefined} down={index<items.length-1?()=>move(item,items[index+1]):undefined}/>)}</div>}
  {more&&<button className="button secondary" disabled={loading||busy} onClick={()=>load(true)}>{loading?'Loading…':'Load more'}</button>}
  {edit&&<OwnerEdit item={edit} kind={kind} close={()=>setEdit(undefined)} saved={()=>{setEdit(undefined);setNotice('Saved.');void load();}} onAccessLost={onAccessLost}/>}
 </>;
}

export function OwnerRow({item,kind,disabled,edit,open,up,down}:{item:OwnerItem;kind:'requests'|'reviews';disabled:boolean;edit:()=>void;open:()=>void;up?:()=>void;down?:()=>void}){
 return <article className="owner-item">
  <div className="owner-item-meta"><span>{item.author} · {dateLabel(item.created_at)}</span><span className="status-pill">{kind==='requests'?statusName(item.status||'open'):`${item.rating} / 5 stars`}</span>{item.visibility!=='published'&&<span className="pill warning">{visibilityName(item.visibility)}</span>}{!!item.flags&&<span className="pill warning">{item.flags} reports</span>}</div>
  <h3>{item.title}</h3>{item.headline&&<strong className="review-headline">{item.headline}</strong>}<p className="message-body">{item.body}</p>
  <div className="owner-item-actions"><div className="owner-primary-actions"><button className="button secondary compact-button" disabled={disabled} onClick={edit}>{kind==='requests'?'Edit request':'Moderate review'}</button>{kind==='requests'&&item.visibility==='published'&&<button className="button primary compact-button" disabled={disabled} onClick={open}>Reply · {item.comment_count||0}</button>}</div>{kind==='requests'&&<div className="queue-order"><span>{item.vote_count||0} votes</span><button className="order-button" disabled={disabled||!up} onClick={up} aria-label={`Move ${item.title} up`}>↑</button><button className="order-button" disabled={disabled||!down} onClick={down} aria-label={`Move ${item.title} down`}>↓</button></div>}</div>
 </article>;
}

function OwnerEdit({item,kind,close,saved,onAccessLost}:{item:OwnerItem;kind:'requests'|'reviews';close:()=>void;saved:()=>void;onAccessLost:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),gate=useRef(createActionGate()).current;
 const [title,setTitle]=useState(item.title),[body,setBody]=useState(item.body),[status,setStatus]=useState(item.status||'open'),[visibility,setVisibility]=useState(item.visibility),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{dialog.current?.showModal();return()=>gate.invalidate();},[gate]);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();const attempt=gate.begin();if(attempt===null)return;setBusy(true);setError('');try{await api('owner_save',{kind,id:item.id,revision:item.revision,visibility,...(kind==='requests'?{title,body,status}:{})});if(gate.isCurrent(attempt))saved();}catch(e){if(!gate.isCurrent(attempt))return;if(e instanceof ApiError&&[401,403].includes(e.status)){close();onAccessLost();}else setError((e as Error).message);}finally{if(gate.finish(attempt))setBusy(false);}};
 return <dialog ref={dialog} className="owner-dialog" aria-labelledby="edit-heading" onCancel={e=>{if(busy)e.preventDefault();else close();}}><form onSubmit={submit}>
  <div className="dialog-heading"><h2 id="edit-heading">{kind==='requests'?'Edit request':'Moderate review'}</h2><button type="button" className="order-button" disabled={busy} onClick={close} aria-label="Close editor">×</button></div>
  {kind==='requests'?<><label htmlFor="edit-title">Title</label><input autoFocus id="edit-title" required minLength={3} maxLength={120} value={title} disabled={busy} onChange={e=>setTitle(e.target.value)}/><label htmlFor="edit-body">Details</label><textarea id="edit-body" required minLength={10} maxLength={1500} rows={6} disabled={busy} value={body} onChange={e=>setBody(e.target.value)}/><label htmlFor="edit-status">Status</label><select id="edit-status" value={status} disabled={busy} onChange={e=>setStatus(e.target.value)}>{['open','planned','in_progress','shipped'].map(s=><option value={s} key={s}>{statusName(s)}</option>)}</select></>:<><h3>{item.title}</h3><p className="message-body">{item.body}</p></>}
  <label htmlFor="edit-visibility">Visibility</label><select id="edit-visibility" value={visibility} disabled={busy} onChange={e=>setVisibility(e.target.value)}><option value="published">Visible to readers</option><option value="hidden">Hidden from readers</option><option value="removed">Move to trash</option></select>
  {visibility==='removed'&&<p className="notice">Remove this from public view? You can restore it from Trash.</p>}{kind==='requests'&&<p className="fine-print">Edits keep the original author and votes.</p>}
  {error&&<p className="notice error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button secondary" type="button" onClick={close} disabled={busy}>Cancel</button><button className="button primary" disabled={busy}>{busy?'Saving…':visibility==='removed'?'Move to trash':'Save changes'}</button></div>
 </form></dialog>;
}

type DiscordChannel={id:string;title:string;scope:'public'|'private'};
type DiscordMessage={id:string;body:string;author:string;editable:boolean;created_at:string;edited_at?:string;embeds:string;attachments:number};
function DiscordDesk({onAccessLost}:{onAccessLost:()=>void}){
 const [channels,setChannels]=useState<DiscordChannel[]>([]),[channel,setChannel]=useState<DiscordChannel>(),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const generation=useRef(0);
 const load=async()=>{const g=++generation.current;setLoading(true);setError('');try{const result=await api<DiscordChannel[]>('discord_channels');if(g===generation.current)setChannels(result);}catch(e){if(g!==generation.current)return;if(e instanceof ApiError&&[401,403].includes(e.status))onAccessLost();else setError((e as Error).message);}finally{if(g===generation.current)setLoading(false);}};
 useEffect(()=>{void load();return()=>{generation.current++;};},[]);
 return channel?<DiscordConversation key={channel.id} channel={channel} back={()=>setChannel(undefined)} onAccessLost={onAccessLost}/>:<><div className="desk-toolbar"><div><h2>Discord support</h2><p className="muted">Reply through TopBook’s bot.</p></div><button className="button secondary compact-button" disabled={loading} onClick={load}>Refresh</button></div>{error&&<p role="alert" className="notice error">{error}</p>}{loading?<p className="empty" role="status">Connecting to Discord…</p>:!channels.length&&!error?<p className="empty">No accessible support conversations yet.</p>:<div className="thread-list">{channels.map(c=><button className="thread-row" key={c.id} onClick={()=>setChannel(c)}><div><span className="pill">{c.scope==='private'?'Private ticket':'Public support'}</span><h2>#{c.title}</h2></div><span aria-hidden="true">→</span></button>)}</div>}</>;
}

function DiscordConversation({channel,back,onAccessLost}:{channel:DiscordChannel;back:()=>void;onAccessLost:()=>void}){
 const [messages,setMessages]=useState<DiscordMessage[]>([]),[body,setBody]=useState(''),[editing,setEditing]=useState<DiscordMessage>(),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[more,setMore]=useState(false);
 const gate=useRef(createActionGate()).current,generation=useRef(0),cid=useRef(crypto.randomUUID());
 const fail=(e:unknown)=>{if(e instanceof ApiError&&[401,403].includes(e.status)){setMessages([]);onAccessLost();}else setError((e as Error).message);};
 const load=async(older=false)=>{const g=++generation.current;setLoading(true);setError('');try{const result=await api<DiscordMessage[]>('discord_messages',{channel_id:channel.id,...(older&&messages.length?{before:messages[0].id}:{})});if(g!==generation.current)return;setMessages(old=>older?[...result.filter(m=>!old.some(o=>o.id===m.id)),...old]:result);setMore(result.length===50);}catch(e){if(g===generation.current)fail(e);}finally{if(g===generation.current)setLoading(false);}};
 useEffect(()=>{void load();return()=>{generation.current++;gate.invalidate();};},[]);
 const send=async(e:React.FormEvent)=>{e.preventDefault();const attempt=gate.begin();if(attempt===null)return;setBusy(true);setError('');setNotice('');try{await api(editing?'discord_edit':'discord_reply',{channel_id:channel.id,body,client_id:cid.current,...(editing?{message_id:editing.id,original_body:editing.body}:{})});if(!gate.isCurrent(attempt))return;setBody('');setEditing(undefined);cid.current=crypto.randomUUID();setNotice('Saved in Discord.');await load();}catch(e){if(gate.isCurrent(attempt))fail(e);}finally{if(gate.finish(attempt))setBusy(false);}};
 return <><button className="back" disabled={busy} onClick={back}>← Discord conversations</button><div className="desk-toolbar"><div><span className="eyebrow">{channel.scope==='private'?'Private ticket':'Public support'}</span><h2>#{channel.title}</h2></div><button className="button secondary compact-button" disabled={loading||busy} onClick={()=>load()}>Refresh</button></div>{error&&<p className="notice error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}{more&&<button className="button secondary" disabled={loading} onClick={()=>load(true)}>Older messages</button>}
  <div className="messages">{!messages.length&&<p className="empty">{loading?'Loading messages…':'No messages yet.'}</p>}{messages.map(m=><article className={'message '+(m.editable?'staff-message':'')} key={m.id}><div className="message-meta"><strong>{m.author}</strong>{m.editable&&<span className="staff-badge">TopBook bot</span>}<time dateTime={m.created_at}>{dateLabel(m.created_at)}{m.edited_at?' · edited':''}</time></div><p className="message-body">{m.body||(!m.embeds?'No text in this message.':'')}</p>{m.embeds&&<p className="message-body discord-embed">{m.embeds}</p>}{!!m.attachments&&<p className="fine-print">{m.attachments} attachment{m.attachments===1?'':'s'} · view in Discord</p>}{m.editable&&<button className="text-button" disabled={busy||!!body.trim()} onClick={()=>{setEditing(m);setBody(m.body);}}>Edit bot reply</button>}</article>)}</div>
  <form className="reply-form" onSubmit={send}><label htmlFor="discord-reply">{editing?'Edit bot reply':`Reply in #${channel.title}`}</label><textarea id="discord-reply" rows={4} maxLength={2000} required disabled={busy} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a helpful reply…"/><p className="fine-print">Sent as TopBook’s bot. {channel.scope==='private'?'Visible to this ticket’s participants.':'Visible to everyone in #support.'}</p><div className="form-actions"><button className="button primary" disabled={busy||!body.trim()}>{busy?'Sending…':editing?'Save in Discord':'Send to Discord'}</button>{editing&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setEditing(undefined);setBody('');}}>Cancel edit</button>}</div></form>
 </>;
}
