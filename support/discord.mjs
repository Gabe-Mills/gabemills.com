// Live, owner-only Discord support bridge. No copying ticket contents into a
// public forum, no arbitrary channel paths, and no automatic @everyone pings.
const SNOWFLAKE=/^[0-9]{17,20}$/;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function allowedSupportChannel(channel,env){
  return channel?.guild_id===env.DISCORD_GUILD_ID && channel.type===0 &&
    (channel.id===env.DISCORD_SUPPORT_CHANNEL ||
      (channel.parent_id===env.DISCORD_TICKETS_CATEGORY && channel.id!==env.DISCORD_TICKET_PANEL));
}
export async function discordAction(env,action,data,fetcher=fetch){
  if(!env.DISCORD_BOT_TOKEN||![env.DISCORD_GUILD_ID,env.DISCORD_SUPPORT_CHANNEL,env.DISCORD_TICKETS_CATEGORY,env.DISCORD_TICKET_PANEL,env.DISCORD_BOT_ID].every(x=>SNOWFLAKE.test(x||'')))
    throw fail('Discord support is not connected yet.',503);
  const call=async(path,method='GET',body)=>{
    const response=await fetcher('https://discord.com/api/v10'+path,{
      method,headers:{Authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)throw fail(response.status===429?'Discord is busy. Wait a moment and refresh.':response.status===403?'The bot cannot access this conversation. Check its Discord permissions.':'Discord could not complete that action. Refresh the conversation before retrying.',response.status===429?429:503);
    return response.json();
  };
  if(action==='discord_channels'){
    const channels=await call(`/guilds/${env.DISCORD_GUILD_ID}/channels`);
    return channels.filter(c=>allowedSupportChannel({...c,guild_id:env.DISCORD_GUILD_ID},env)).map(c=>({id:c.id,title:c.name,scope:c.id===env.DISCORD_SUPPORT_CHANNEL?'public':'private'}));
  }
  if(!SNOWFLAKE.test(data?.channel_id||''))throw fail('Choose a support conversation.');
  const channel=await call(`/channels/${data.channel_id}`);
  if(!allowedSupportChannel(channel,env))throw fail('This channel is not in the TopBook support workspace.',403);
  const path=`/channels/${channel.id}/messages`;
  if(action==='discord_messages'){
    if(data.before!==undefined&&!SNOWFLAKE.test(data.before))throw fail('Invalid message page.');
    const messages=await call(path+'?limit=50'+(data.before?'&before='+data.before:''));
    return messages.map(m=>({id:m.id,body:m.content||'',author:m.author?.global_name||m.author?.username||'Discord reader',
      editable:m.author?.id===env.DISCORD_BOT_ID&&!m.webhook_id,created_at:m.timestamp,edited_at:m.edited_timestamp,
      embeds:(m.embeds||[]).slice(0,10).map(e=>[e.title,e.description,...(e.fields||[]).map(f=>`${f.name}\n${f.value}`)].filter(Boolean).join('\n')).join('\n\n').slice(0,16000),
      attachments:(m.attachments||[]).length})).reverse();
  }
  if(!['discord_reply','discord_edit'].includes(action))throw fail('Unknown Discord action.');
  const body=typeof data.body==='string'?data.body.trim():'';
  if(!body||body.length>2000)throw fail('Write a reply of 1–2,000 characters.');
  if(action==='discord_edit'){
    if(!SNOWFLAKE.test(data.message_id||''))throw fail('Choose a message to edit.');
    const old=await call(`${path}/${data.message_id}`);
    if(old.author?.id!==env.DISCORD_BOT_ID||old.webhook_id)throw fail('Only this bot’s replies can be edited here.',403);
    if(old.content!==data.original_body)throw fail('This reply changed. Refresh before editing it.',409);
    const updated=await call(`${path}/${data.message_id}`,'PATCH',{content:body,allowed_mentions:{parse:[],replied_user:false}});
    return {id:updated.id};
  }
  if(!/^[0-9a-f-]{36}$/.test(data.client_id||''))throw fail('Refresh before sending.');
  const sent=await call(path,'POST',{content:body,allowed_mentions:{parse:[],replied_user:false},
    nonce:data.client_id.replaceAll('-','').slice(0,25),enforce_nonce:true});
  return {id:sent.id};
}
