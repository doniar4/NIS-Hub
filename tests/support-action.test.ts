import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {runInNewContext} from "node:vm";
import {resolve} from "node:path";
import type {ActionState} from "../src/lib/action-state";

const id="00000000-0000-4000-8000-000000000030";
test("actual ticket action commits full data first, sends a bounded summary from trusted profile, and redirects through failures",async()=>{
 const fixtures:Record<string,string>={
  "@/lib/auth":'export async function actionContext(){return globalThis.fixtureContext;}',
  "@/lib/i18n-server":'export async function getI18n(){return {locale:"ru"};}',
  "next/cache":'export function revalidatePath(){}',
  "next/navigation":'export function redirect(path){throw new Error("REDIRECT:"+path);}',
  "server-only":'export {};',
 };
 const result=await build({entryPoints:[resolve("src/app/actions/support.ts")],write:false,bundle:true,platform:"node",format:"cjs",logLevel:"silent",
  plugins:[{name:"isolated-support-session",setup(api){
   api.onResolve({filter:/.*/},args=>Object.prototype.hasOwnProperty.call(fixtures,args.path)?{path:args.path,namespace:"fixture"}:undefined);
   api.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:fixtures[args.path],loader:"js"}));
  }}]});
 for(const scenario of ["ok","telegram-error","telegram-throw","profile-error","profile-throw","missing-name","db-error"]){
  const events:string[]=[],sent:string[]=[],logs:unknown[][]=[];
  const form=new FormData();
  form.set("category","library");form.set("title","  Книга <не открывается>  ");
  form.set("description","x".repeat(401)+"PRIVATE_TAIL");
  form.set("display_name","FORGED_NAME");form.set("email","forged@example.org");
  const context={user:{id:"authenticated-owner",email:"account@example.org"},supabase:{
   rpc:async(name:string,params:Record<string,string>)=>{
    assert.equal(name,"create_support_ticket");assert.equal(params.p_title,"Книга <не открывается>");
    assert.equal(params.p_description,form.get("description"));events.push("persist");
    return {data:scenario==="db-error"?null:id,error:scenario==="db-error"?{message:"private database details"}:null};
   },
   from:(table:string)=>{assert.equal(table,"profiles");return {
    select:(column:string)=>{assert.equal(column,"display_name");return {
     eq:(column:string,value:string)=>{assert.equal(column,"id");assert.equal(value,"authenticated-owner");return {
      abortSignal:(signal:AbortSignal)=>{assert.ok(signal);return {maybeSingle:async()=>{
       events.push("profile");assert.equal(events[0],"persist");
       if(scenario==="profile-throw")throw new Error("private profile details");
       return {data:scenario==="missing-name"?null:{display_name:"Айдана"},error:scenario==="profile-error"?{}:null};
      }};}
     };}
    };}
   };}
  }};
  const mod={exports:{} as {createTicket:(state:ActionState,form:FormData)=>Promise<ActionState>}};
  runInNewContext(result.outputFiles[0].text,{
   module:mod,exports:mod.exports,fixtureContext:context,URL,AbortSignal,
   process:{env:{TELEGRAM_BOT_TOKEN:"test-only",TELEGRAM_ADMIN_CHAT_ID:"test-chat",APP_BASE_URL:"https://school.example"}},
   console:{warn:(...args:unknown[])=>logs.push(args)},
   fetch:async(_url:string,init:RequestInit)=>{
    events.push("notify");const body=String(init.body);sent.push(body);
    if(scenario==="telegram-throw")throw new Error("private transport details");
    return Response.json({ok:scenario!=="telegram-error"},{status:scenario==="telegram-error"?500:200});
   },
  });
  if(scenario==="db-error"){
   const state=await mod.exports.createTicket({},form);assert.ok(state.error);
   assert.deepEqual(events,["persist"]);assert.deepEqual(sent,[]);
  }else{
   await assert.rejects(mod.exports.createTicket({},form),new RegExp("REDIRECT:/support/"+id));
   assert.deepEqual(events,["persist","profile","notify"]);assert.equal(sent.length,1);
   const body=JSON.parse(sent[0]);assert.equal(body.parse_mode,"HTML");
   assert.match(body.text,/Книга &lt;не открывается&gt;/);
   assert.ok(body.text.includes("x".repeat(399)+"…"));
   for(const forbidden of ["PRIVATE_TAIL","FORGED_NAME","account@example.org","forged@example.org","private profile","private transport"])assert.ok(!sent[0].includes(forbidden));
   assert.equal(body.text.includes("Айдана"),!["profile-error","profile-throw","missing-name"].includes(scenario));
   assert.ok(!JSON.stringify(logs).includes("private"));
  }
 }
});
