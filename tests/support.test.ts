import test from "node:test";
import assert from "node:assert/strict";
import {persistTicketThenNotify,ticketSchema} from "../src/lib/support";
import {sendTicketNotice} from "../src/lib/telegram-transport";
import {v05Copy} from "../src/lib/v05-copy";
test("notification failure never rolls back or repeats canonical ticket persistence",async()=>{
 let saves=0;const id=await persistTicketThenNotify(async()=>{saves++;return "saved-ticket";},async value=>{assert.equal(value,"saved-ticket");throw new Error("secret transport error");});
 assert.equal(id,"saved-ticket");assert.equal(saves,1);
 let sent=false;await assert.rejects(persistTicketThenNotify(async()=>{throw new Error("DB failed");},async()=>{sent=true;}));assert.equal(sent,false);
});
test("Telegram sends only minimal metadata; disabled, rejected, timeout and malformed responses fail safely",async()=>{
 const ticket={id:"ticket-ref",category:"platform",createdAt:"2026-09-14T10:00:00Z"},config={token:"test-only",chatId:"test-chat",origin:"https://school.example"};
 const request:typeof fetch=async(url,init)=>{assert.equal(String(url),"https://api.telegram.org/bottest-only/sendMessage");const body=JSON.parse(String(init?.body));assert.equal(body.text,"NIS Hub · new support ticket\nticket-ref\nplatform\n2026-09-14T10:00:00Z\nhttps://school.example/support/ticket-ref");assert.equal(body.link_preview_options.is_disabled,true);assert.ok(init?.signal);assert.equal(init?.redirect,"error");return Response.json({ok:true});};
 assert.equal(await sendTicketNotice(ticket,config,request),"sent");assert.equal(await sendTicketNotice(ticket,null,request),"disabled");
 for(const response of [()=>Promise.reject(new DOMException("Timed out","TimeoutError")),()=>Promise.resolve(Response.json({ok:false})),()=>Promise.resolve(new Response("bad",{status:500}))])
 assert.equal(await sendTicketNotice(ticket,config,response),"failed");
 assert.equal(await sendTicketNotice(ticket,{...config,origin:"https://user:password@school.example"},request),"failed");
 assert.equal(await sendTicketNotice(ticket,{...config,origin:"https://school.example/?token=bad"},request),"failed");
});
test("ticket validation and every v0.5 locale are complete",()=>{
 assert.equal(ticketSchema.safeParse({category:"other",title:"  ",description:"text"}).success,false);
 assert.equal(ticketSchema.safeParse({category:"other",title:"Hello",description:"x".repeat(5001)}).success,false);
 for(const locale of ["ru","kk","en"] as const){const copy=v05Copy(locale);assert.deepEqual(Object.keys(copy),Object.keys(v05Copy("ru")));for(const value of Object.values(copy))assert.ok(typeof value==="string"?value.trim():Object.values(value).every(v=>v.trim()));}
});
