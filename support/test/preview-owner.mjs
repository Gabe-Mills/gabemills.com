// Local-only interaction fixture. Never imported by Vite's production entry or Worker.
import {createServer as createHTTPServer} from 'node:http';
import {createServer} from 'vite';
const vite=await createServer({configFile:'support/vite.config.ts',server:{middlewareMode:true,hmr:false,watch:{usePolling:true}},appType:'spa'});
const now='2026-09-08T12:00:00Z';
let revision=1;
const items=[
 {id:'10000000-0000-4000-8000-000000000001',title:'Save different reading preferences for my family',body:'Could I switch between my own preferences and my child’s preferences before scanning? I would love separate saved settings for each reader, with an obvious way to see whose settings are active.',status:'open',visibility:'published',author:'Avery',vote_count:12,comment_count:1,created_at:now,revision:'1'},
 {id:'10000000-0000-4000-8000-000000000002',title:'Keep the last scan when I go offline',body:'When the connection drops in a bookstore, I want to keep reading the result I already scanned instead of starting again.',status:'planned',visibility:'published',author:'Jordan',vote_count:8,comment_count:0,created_at:now,revision:'1'},
];
const reviews=[{id:'20000000-0000-4000-8000-000000000001',title:'The Last Olympian',headline:'An exciting finish',body:'A fast-moving adventure with battle scenes. I liked the friendships and the way the story finished.',rating:4,visibility:'published',author:'Morgan',created_at:now,revision:'1'}];
const threads=[{id:'30000000-0000-4000-8000-000000000001',title:'My library isn’t showing on my new phone',scope:'private',category:'account',status:'open',hidden:false,author:'Sam',messages:2,flags:0,created_at:now,updated_at:now}];
const replies=[{id:'1',body:'I signed in on my new phone but my saved books haven’t appeared yet. Could you help me check the account?',author:'Sam',staff:false,created_at:now},{id:'2',body:'Checking sync status. No billing change needed.',author:'TopBook',staff:true,internal:true,created_at:now}];
const updates=[{id:'u1',body:'Thanks for this idea. We’re considering an easier family profile switcher.',author:'TopBook',staff:true,created_at:now}];
const discord=[{id:'66666666666666666',body:'Is this the right place to ask about a scan result?',author:'Riley',editable:false,created_at:now,embeds:'',attachments:0},{id:'77777777777777777',body:'Yes—send the book title and we can take a look.',author:'TopBook',editable:true,created_at:now,embeds:'',attachments:0}];
const server=createHTTPServer(async(req,res)=>{
 if(req.url.startsWith('/support/api/')){
  let raw='';for await(const chunk of req)raw+=chunk;const {action,data={}}=JSON.parse(raw||'{}');let result={ok:true};
  if(action==='session')result={signedIn:true,admin:true,name:'Gabe · local preview'};
  else if(action==='owner_list')result=(data.kind==='reviews'?reviews:items).filter(i=>data.visibility==='all'||i.visibility===data.visibility);
  else if(action==='owner_save'){const item=(data.kind==='reviews'?reviews:items).find(i=>i.id===data.id);Object.assign(item,data,{revision:String(++revision)});}
  else if(action==='owner_move'){const a=items.findIndex(i=>i.id===data.id),b=items.findIndex(i=>i.id===data.target_id);[items[a],items[b]]=[items[b],items[a]];}
  else if(action==='inbox'||action==='tickets')result=threads;
  else if(action==='thread')result={...threads[0],messages:replies};
  else if(action==='request_comments')result=updates;
  else if(action==='reply'||action==='request_comment')(action==='reply'?replies:updates).push({id:crypto.randomUUID(),body:data.body,author:'TopBook',staff:true,internal:data.internal,created_at:now});
  else if(action==='status')threads[0].status=data.status;
  else if(action==='discord_channels')result=[{id:'22222222222222222',title:'support',scope:'public'},{id:'88888888888888888',title:'ticket-014',scope:'private'}];
  else if(action==='discord_messages')result=discord;
  else if(action==='discord_reply')discord.push({id:crypto.randomUUID(),body:data.body,author:'TopBook',editable:true,created_at:now,embeds:'',attachments:0});
  else if(action==='discord_edit')discord.find(m=>m.id===data.message_id).body=data.body;
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));return;
 }
 vite.middlewares(req,res,()=>{res.writeHead(404);res.end();});
});
server.listen(4178,'127.0.0.1',()=>console.log('Owner preview with synthetic data only: http://127.0.0.1:4178/support/desk'));
process.on('SIGTERM',()=>{server.close();void vite.close();});
