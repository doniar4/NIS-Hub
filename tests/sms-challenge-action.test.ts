import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { SmsResult } from "../src/lib/sms/types";

const require = createRequire(import.meta.url);
const pendingCookie = "__Host-nis-sms-pending", authCookie = "__Host-nis-sms";
const iin = "000000000001", password = "synthetic-private-password";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const fixtures: Record<string,string> = {
  "server-only": "export {};",
  "@/lib/auth": "export async function actionContext(){return globalThis.auth;}",
  "next/headers": "export async function cookies(){return globalThis.cookieStore;}",
};
const compiled = build({entryPoints:["src/app/actions/sms.ts"],bundle:true,write:false,format:"cjs",platform:"node",plugins:[{name:"challenge-action-boundary",setup(b){
  b.onResolve({filter:/.*/},args=>fixtures[args.path]?{path:args.path,namespace:"fixture"}:undefined);
  b.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:fixtures[args.path]}));
}}]});
type Actions = {connectSms:(form:FormData)=>Promise<SmsResult>;continueSmsLogin:(form:FormData)=>Promise<SmsResult>;sendSmsLoginCode:(form:FormData)=>Promise<SmsResult>;cancelSmsLogin:()=>Promise<SmsResult>};

async function harness(responses: unknown[]) {
  let now = Date.now(), posts = 0, sends = 0;
  const secret = randomBytes(32), jar = new Map<string,{value:string;options:Record<string,unknown>}>();
  const calls: string[] = [], submitted: Record<string,string>[] = [];
  const deletion = {eq:()=>deletion,not:()=>deletion,like:()=>deletion,then:(resolve:(value:unknown)=>void)=>resolve({error:null})};
  const auth = {user:{id:"owner"},supabase:{from:()=>({delete:()=>deletion}),rpc:()=>{throw Error("Unexpected overflow");}}};
  const mod = {exports:{} as Actions};
  class Clock extends Date { constructor(value?: string | number) { super(value ?? now); } static now(){ return now; } }
  const respond = (body:string,type="text/html",cookie?:string)=>new Response(body,{headers:{"content-type":type,...(cookie?{"set-cookie":cookie}:{})}});
  runInNewContext((await compiled).outputFiles[0].text,{
    module:mod,exports:mod.exports,require,Buffer,URL,URLSearchParams,Uint8Array,AbortController,setTimeout,clearTimeout,Date:Clock,auth,
    process:{env:{NODE_ENV:"production",SMS_DIARY_ENABLED:"true",SMS_SESSION_SECRET:secret.toString("base64")}},
    console:{log:()=>assert.fail("Unexpected logging"),warn:()=>assert.fail("Unexpected logging"),error:()=>assert.fail("Unexpected logging")},
    cookieStore:{get:(name:string)=>jar.get(name),set:(name:string,value:string,options:Record<string,unknown>)=>jar.set(name,{value,options}),delete:(name:string)=>jar.delete(name)},
    fetch:async(input:URL,init:RequestInit)=>{
      calls.push(input.pathname);
      if(input.pathname.endsWith("/Login"))return respond(readFileSync("tests/fixtures/sms/login.html","utf8"),"text/html","Uralsk_SessionID=synthetic-session; Path=/");
      assert.match(new Headers(init.headers).get("cookie") || "",/Uralsk_SessionID=synthetic-session/);
      if(input.pathname.includes("/res/"))return respond('name:"login";name:"password";App.buildUrl("LogOn","Account");loginForm.submit(',"text/javascript");
      if(input.pathname.endsWith("/RefreshRestoreCaptcha"))return respond(JSON.stringify({success:true,data:{captchaType:0,captchaData:png}}),"application/json");
      if(input.pathname.endsWith("/SendTwoFactorAuthCode")){sends++;assert.equal(init.method,"POST");return respond(JSON.stringify({success:true}),"application/json");}
      if(input.pathname.endsWith("/LogOn")){
        const fields=Object.fromEntries(init.body as URLSearchParams);submitted.push(fields);
        assert.equal(fields.login,iin);assert.equal(fields.password,password);
        assert.equal(fields.__RequestVerificationToken,"synthetic-csrf");
        assert.ok(posts<responses.length,"Unexpected login submission");
        return respond(JSON.stringify(responses[posts++]),"application/json");
      }
      if(input.pathname==="/root")return respond('<script>Ext.apply(App.Server, {"User":{"IsAuthenticated":true}});</script>');
      if(input.pathname==="/jcediary/index/0")return respond('<script src="/JCEJournal/JceDiary/app.js"></script>');
      if(input.pathname==="/Ref/GetSchoolYears")return respond(JSON.stringify({success:true,data:[{Id:"11111111-1111-4111-8111-111111111111",Name:"2026–2027",Data:{IsActual:true}}],total:1}),"application/json");
      if(input.pathname==="/Ref/GetPeriods")return respond(JSON.stringify({success:true,data:[{Id:"22222222-2222-4222-8222-222222222222",Name:"I четверть",Data:null}],total:1}),"application/json");
      throw Error("Unexpected route "+input.pathname);
    },
  });
  const form=(answers:Record<string,string>={})=>{const value=new FormData();for(const [key,item] of Object.entries({iin,password,...answers}))value.set(key,item);return value;};
  const plaintext=()=>{
    const raw=jar.get(pendingCookie)?.value;if(!raw?.startsWith("v1.pending."))throw new Error("Missing pending SMS challenge cookie");
    const bytes=Buffer.from(raw.slice("v1.pending.".length),"base64url"), decipher=createDecipheriv("aes-256-gcm",secret,bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(12,28));decipher.setAAD(Buffer.from("nis-sms-pending-v1:owner"));
    return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString();
  };
  return {actions:mod.exports,jar,calls,submitted,auth,form,plaintext,tick:(ms=2100)=>{now+=ms;},sends:()=>sends};
}

test("SMS actions continue CAPTCHA and app OTP in the original session without storing credentials",async()=>{
  const h=await harness([{success:false,data:{captchaType:0,captchaData:png}},{success:false,data:{needApplication2FA:true}},{success:true,data:{url:"/root"}}]);
  const firstForm=h.form(), first=await h.actions.connectSms(firstForm);
  assert.equal(firstForm.has("password"),false);assert.equal(first.challenge?.captcha,true);assert.equal(first.connected,false);
  assert.equal(h.jar.has(authCookie),false);assert.equal(h.jar.get(pendingCookie)?.options.httpOnly,true);
  const initial=JSON.parse(h.plaintext());
  assert.ok(!h.plaintext().includes(password));assert.ok(!h.plaintext().includes(iin));
  assert.ok(!JSON.stringify(first).includes(password));assert.ok(!JSON.stringify(first).includes("synthetic-session"));
  h.tick();const second=await h.actions.continueSmsLogin(h.form({captchaInput:"manual-answer"}));
  assert.equal(second.challenge?.application2FA,true);assert.equal(second.challenge?.captcha,true);
  assert.equal(second.challenge?.expiresAt,first.challenge?.expiresAt);assert.ok(h.calls.some(path=>path.endsWith("/RefreshRestoreCaptcha")));
  assert.ok(!h.plaintext().includes("manual-answer"));assert.equal(JSON.parse(h.plaintext()).expires,initial.expires);
  h.tick();const third=await h.actions.continueSmsLogin(h.form({captchaInput:"new-answer",application2FACode:"123456"}));
  assert.equal(third.connected,true);assert.ok(third.snapshot);assert.equal(h.jar.has(pendingCookie),false);assert.equal(h.jar.has(authCookie),true);
  assert.equal(h.submitted[2].application2FACode,"123456");assert.equal(h.submitted[2].captchaInput,"new-answer");
});

test("SMS pending challenge expires, cancels and rejects another owner without submitting credentials",async()=>{
  for(const mode of ["expired","cancelled","wrong-owner"]){
    const h=await harness([{success:false,data:{needApplication2FA:true}}]);await h.actions.connectSms(h.form());
    if(mode==="expired")h.tick(300001);
    else {h.tick();if(mode==="cancelled")await h.actions.cancelSmsLogin();else h.auth.user.id="another-owner";}
    const count=h.calls.length,result=await h.actions.continueSmsLogin(h.form({application2FACode:"123456"}));
    assert.equal(result.error,"session_expired",mode);assert.equal(h.calls.length,count);assert.equal(h.jar.has(pendingCookie),false);
  }
});

test("SMS empty OTP is rejected before network and a failed OTP keeps a retryable pending session",async()=>{
  const h=await harness([{success:false,data:{needApplication2FA:true}},{success:false,data:"TwoFactorAuthInfo",message:"PRIVATE PROVIDER TEXT"}]);
  await h.actions.connectSms(h.form());h.tick();
  const count=h.calls.length,invalid=await h.actions.continueSmsLogin(h.form());
  assert.equal(invalid.error,"invalid_input");assert.equal(h.calls.length,count);assert.equal(h.jar.has(pendingCookie),true);
  h.tick();const wrong=await h.actions.continueSmsLogin(h.form({application2FACode:"654321"}));
  assert.equal(wrong.error,"verification_failed");assert.equal(h.jar.has(pendingCookie),true);assert.ok(!JSON.stringify(wrong).includes("PRIVATE"));
});

test("SMS code is sent only explicitly and server enforces resend cooldown",async()=>{
  const h=await harness([{success:false,data:"TwoFactorAuth"}]);
  const first=await h.actions.connectSms(h.form());assert.equal(first.challenge?.twoFactor,true);assert.equal(h.sends(),0);
  h.tick();const sent=await h.actions.sendSmsLoginCode(h.form());assert.equal(h.sends(),1);assert.ok(sent.challenge?.resendAt);
  h.tick();const repeated=await h.actions.sendSmsLoginCode(h.form());assert.equal(repeated.error,"busy");assert.equal(h.sends(),1);
  h.tick(60000);const later=await h.actions.sendSmsLoginCode(h.form());assert.equal(later.error,undefined);assert.equal(h.sends(),2);
});

test("SMS password change and Google CAPTCHA fall back without a pending or authenticated session",async()=>{
  for(const data of ["NeedChangePassword",{captchaType:2,captchaData:"public-site-key"}]){
    const h=await harness([{success:false,data}]);const result=await h.actions.connectSms(h.form());
    assert.equal(result.error,"interactive_required");assert.equal(h.jar.size,0);
  }
});
