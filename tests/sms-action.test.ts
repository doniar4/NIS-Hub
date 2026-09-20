import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {runInNewContext} from "node:vm";
import {createRequire} from "node:module";
import {randomBytes} from "node:crypto";
import {readFileSync} from "node:fs";
import type {SmsResult} from "../src/lib/sms/types";
const require=createRequire(import.meta.url);
test("Actual SMS action: auth first, transient credentials, safe errors, secure cookie and encrypted overflow",{timeout:20000},async()=>{
 const fixtures:Record<string,string>={
  "server-only":"export {};",
  "@/lib/auth":"export async function actionContext(){if(globalThis.scenario==='unauth')throw Error('private-auth-detail');return globalThis.auth;}",
  "next/headers":"export async function cookies(){return globalThis.cookieStore;}",
 };
 const compiled=await build({entryPoints:["src/app/actions/sms.ts"],bundle:true,write:false,format:"cjs",platform:"node",plugins:[{name:"action-boundary",setup(b){b.onResolve({filter:/.*/},args=>fixtures[args.path]?{path:args.path,namespace:"fixture"}:undefined);b.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:fixtures[args.path]}));}}]});
 const html=readFileSync("tests/fixtures/sms/login.html","utf8"), script='name:"login";name:"password";App.buildUrl("LogOn","Account");loginForm.submit(';
 for(const scenario of ["normal","overflow","unauth","bad"]){
  const jar=new Map<string,{value:string;options?:Record<string,unknown>}>(),rows:{ciphertext:string}[]=[],calls:string[]=[],logs:unknown[]=[];
  const chain={eq:()=>chain,not:()=>chain,then:(resolve:(value:unknown)=>void)=>{rows.length=0;resolve({error:null});}};
  const auth={user:{id:"owner"},supabase:{from:(table:string)=>{assert.equal(table,"sms_sessions");return {delete:()=>chain};},rpc:async(name:string,args:{p_ciphertext:string;p_expires:string})=>{assert.equal(name,"save_sms_session");rows.push({ciphertext:args.p_ciphertext});assert.ok(Date.parse(args.p_expires)>Date.now());return {data:"00000000-0000-4000-8000-000000000001",error:null};}}};
  const mod={exports:{} as {connectSms:(form:FormData)=>Promise<SmsResult>;disconnectSms:()=>Promise<SmsResult>}};
  runInNewContext(compiled.outputFiles[0].text,{
   module:mod,exports:mod.exports,require,Buffer,URL,URLSearchParams,Uint8Array,AbortController,setTimeout,clearTimeout,scenario,auth,
   process:{env:{NODE_ENV:"production",SMS_DIARY_ENABLED:"true",SMS_SESSION_SECRET:randomBytes(32).toString("base64")}},
   console:{log:(...a:unknown[])=>logs.push(a),warn:(...a:unknown[])=>logs.push(a),error:(...a:unknown[])=>logs.push(a)},
   cookieStore:{get:(name:string)=>jar.get(name),set:(name:string,value:string,options:Record<string,unknown>)=>jar.set(name,{value,options}),delete:(name:string)=>jar.delete(name)},
   fetch:async(input:URL,init:RequestInit)=>{
    calls.push(input.pathname);assert.equal(init.cache,"no-store");
    const respond=(body:string,type="text/html",cookie?:string)=>new Response(body,{headers:{"content-type":type,...(cookie?{"set-cookie":cookie}:{})}});
    if(input.pathname.endsWith("/Login"))return respond(html,"text/html","Uralsk_SessionID=synthetic; Path=/");
    if(input.pathname.includes("/res/"))return respond(script,"text/javascript");
    if(input.pathname.endsWith("/LogOn"))return respond(JSON.stringify(scenario==="bad"?{success:false,message:"PRIVATE_UPSTREAM_DETAIL"}:{success:true,data:{url:"/root"}}),"application/json","auth="+(scenario==="overflow"?"x".repeat(4000):"synthetic-cookie")+"; Path=/");
    return respond('<script>Ext.apply(App.Server, {"User":{"IsAuthenticated":true}});</script>');
   }
  });
  const form=new FormData();form.set("iin","000000000001");form.set("password","synthetic-not-real");
  const result=await mod.exports.connectSms(form);
  if(scenario==="unauth"){assert.equal(calls.length,0);assert.equal(result.error,"session_expired");}
  else{
   assert.equal(form.has("password"),false);assert.equal(form.has("iin"),false);
   if(scenario==="bad"){assert.equal(result.connected,false);assert.equal(result.error,"bad_credentials");assert.equal(jar.size,0);}
   else{
    assert.equal(result.connected,true);assert.equal(result.error,"sms_changed");assert.equal(result.snapshot,undefined);
    const cookie=jar.get("__Host-nis-sms");assert.ok(cookie);assert.equal(cookie.options?.httpOnly,true);assert.equal(cookie.options?.secure,true);assert.equal(cookie.options?.sameSite,"lax");assert.equal(cookie.options?.path,"/");assert.ok(Number(cookie.options?.maxAge)<=1800);
    assert.ok(!cookie.value.includes("synthetic"));assert.equal(cookie.value.startsWith("id."),scenario==="overflow");assert.equal(rows.length,scenario==="overflow"?1:0);assert.ok(!JSON.stringify(rows).includes("synthetic"));
    await mod.exports.disconnectSms();assert.equal(jar.size,0);assert.equal(rows.length,0);
   }
  }
  assert.deepEqual(logs,[]);assert.ok(!JSON.stringify(result).includes("PRIVATE"));assert.ok(!JSON.stringify(result).includes("000000000001"));
 }
});
