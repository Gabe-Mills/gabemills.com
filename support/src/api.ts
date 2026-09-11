export class ApiError extends Error {constructor(message:string,public status:number){super(message);}}
export type Session={signedIn:boolean;admin:boolean;name:string|null};
export type Thread={id:string;title:string;scope:'public'|'private';category:string;status:string;hidden:boolean;created_at:string;updated_at:string;author:string;messages:number;flags:number};
export type Message={id:string;body:string;author?:string;author_name?:string;internal?:boolean;staff:boolean;created_at:string};
export type Conversation=Omit<Thread,'messages'>&{messages:Message[]};
export type Idea={id:string;title:string;body:string;status:string;vote_count:number;comment_count:number;author_name:string;created_at:string};
async function post<T>(route:string,payload:unknown):Promise<T>{
 let r:Response;
 try{r=await fetch('/support/api/'+route,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});}
 catch{const discord=typeof payload==='object'&&payload!==null&&'action' in payload&&String(payload.action).startsWith('discord_');throw new ApiError(discord?'Couldn’t confirm delivery. Your draft is still here. Refresh Discord before sending again.':'Support couldn’t connect. Your draft is still here. Please try again.',503);}
 let data;try{data=await r.json();}catch{throw new ApiError('Support is temporarily unavailable. Please try again.',503);}
 if(!r.ok)throw new ApiError(data.error||'That request couldn’t be completed.',r.status);
 return data;
}
export const api=<T,>(action:string,data:unknown={}):Promise<T>=>post('action',{action,data});
export const signin=(code:string)=>post('signin',{code});
export const statusName=(s:string)=>({open:'Open',in_progress:'In progress',waiting_on_reader:'Waiting for you',resolved:'Resolved',planned:'Planned',shipped:'Shipped'}[s]||s);
export const dateLabel=(s:string)=>new Date(s).toLocaleDateString(undefined,{month:'short',day:'numeric'});
