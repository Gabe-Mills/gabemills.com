import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {canUseAdmin,isAdminPath} from '../access.mjs';

test('admin policy requires a signed-in, explicitly authorized account',()=>{
 for(const session of [null,{}, {signedIn:false,admin:true},{signedIn:true,admin:false},{signedIn:true,admin:'true'},{signedIn:true,name:'Gabe · Admin'}])assert.equal(canUseAdmin(session),false);
 assert.equal(canUseAdmin({signedIn:true,admin:true}),true);
 assert.equal(isAdminPath('/support/desk'),true);assert.equal(isAdminPath('/support/desk/bookmark'),true);assert.equal(isAdminPath('/support'),false);
});
test('request cards render the complete message and reader view has no reply control',async()=>{
 const server=await createServer({configFile:'support/vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
  const {RequestRow,RequestReplyNotice}=await server.ssrLoadModule('/src/main.tsx');
  const body='This is a deliberately long complete request message. '.repeat(12);
  const card=renderToStaticMarkup(React.createElement(RequestRow,{idea:{id:'1',title:'Full request',body,status:'open',vote_count:7,comment_count:2},open:()=>{}}));
  assert.ok(card.includes(body));assert.match(card,/request-copy/);assert.doesNotMatch(card,/truncate-copy|line-clamp/);
  const notice=renderToStaticMarkup(React.createElement(RequestReplyNotice));
  assert.match(notice,/Only TopBook support can reply/);assert.doesNotMatch(notice,/<form|textarea|button/);
 }finally{await server.close();}
});
test('actual rendered help has no search; admin option only renders for authorized owner',async()=>{
 const server=await createServer({configFile:'support/vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
  const {Help,AdminBar}=await server.ssrLoadModule('/src/main.tsx');
  const help=renderToStaticMarkup(React.createElement(Help,{start:()=>{},community:()=>{}}));
  assert.doesNotMatch(help,/<input|<form|Find answer|Type your question|Admin|Owner workspace/);
  for(const label of ['Membership','Scanning','Account','Talk to a human','Browse community'])assert.ok(help.includes(label));
  for(const session of [{signedIn:false,admin:false,name:null},{signedIn:true,admin:false,name:'Gabe'},{signedIn:false,admin:true,name:'Gabe'}])assert.equal(renderToStaticMarkup(React.createElement(AdminBar,{session,selected:false,open:()=>{}})),'');
  const owner=renderToStaticMarkup(React.createElement(AdminBar,{session:{signedIn:true,admin:true,name:'Gabe'},selected:false,open:()=>{}}));
  assert.match(owner,/Admin inbox/);
 }finally{await server.close();}
});
test('owner workspace is absent for ordinary readers and request cards escape complete text',async()=>{
 const server=await createServer({configFile:'support/vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
  const {OwnerDesk,OwnerRow}=await server.ssrLoadModule('/src/OwnerDesk.tsx');
  const common={section:'inbox',setSection:()=>{},open:()=>{},inbox:React.createElement('p',null,'Inbox'),onAccessLost:()=>{}};
  for(const session of [{signedIn:true,admin:false,name:'Gabe'},{signedIn:false,admin:true}])assert.equal(renderToStaticMarkup(React.createElement(OwnerDesk,{...common,session})), '');
  const body='Full message retained. '.repeat(40)+'<script>alert(1)</script>';
  const row=renderToStaticMarkup(React.createElement(OwnerRow,{item:{id:'x',title:'A request',body,visibility:'published',author:'Reader',created_at:'2026-09-08',revision:'1'},kind:'requests',disabled:false,edit:()=>{},open:()=>{}}));
  assert.match(row,/&lt;script&gt;/);assert.doesNotMatch(row,/<script|line-clamp|truncate-copy/);assert.ok(row.includes('Full message retained. '.repeat(40)));
 }finally{await server.close();}
});
