import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { randomBytes } from "node:crypto";
import { filterBooks,HIDDEN_BOOK_TITLE,normalizeLibrarySecret } from "../src/lib/library";
import { parseGrades,gradeFilters } from "../src/lib/sms/parser";
import { v051Database } from "./helpers/v051-database";
import { asUser,fixtureId } from "./helpers/database";
const apiPromise=build({stdin:{contents:'export * from "./src/lib/sms/config";export * from "./src/lib/sms/http";export * from "./src/lib/sms/login";export * from "./src/lib/sms/crypto";export * from "./src/lib/sms/grades";export * from "./src/lib/sms/errors";',resolveDir:process.cwd()},bundle:true,write:false,platform:"node",format:"esm",plugins:[{name:"server-only-test",setup(b){b.onResolve({filter:/^server-only$/},()=>({path:"empty",namespace:"test"}));b.onLoad({filter:/.*/,namespace:"test"},()=>({contents:"export {};"}));}}]})
.then(async r=>await import("data:text/javascript;base64,"+Buffer.from(r.outputFiles[0].contents).toString("base64")) as
 typeof import("../src/lib/sms/http") & typeof import("../src/lib/sms/login") & typeof import("../src/lib/sms/crypto") & typeof import("../src/lib/sms/config") & typeof import("../src/lib/sms/grades") & typeof import("../src/lib/sms/errors"));
const origin="https://sms.ura.nis.edu.kz";
const config=()=>({origin,loginPath:"/Root/Account/Login?ReturnUrl=%2froot",secret:randomBytes(32),timeoutMs:50,maxBytes:2000000});
const login=readFileSync(new URL("./fixtures/sms/login.html",import.meta.url),"utf8");
const grades=readFileSync(new URL("./fixtures/sms/grades-semantic.html",import.meta.url),"utf8");
const script='name:"login";name:"password";App.buildUrl("LogOn","Account");loginForm.submit(';
const authenticated='<script>Ext.apply(App.Server, {"Area":"root","ApplicationPath":"/","User":{"IsAuthenticated":true}});</script>';
function response(body:string,type="text/html",headers:Record<string,string>={}) {return new Response(body,{headers:{"content-type":type,...headers}});}
test("SMS verified login contract preserves GET cookies + hidden fields; JSON success requires authenticated marker",async()=>{
 const {SmsHttp,loginSms}=await apiPromise;const requests:{path:string;method:string}[]=[];
 const transport:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));requests.push({path:url.pathname,method:init?.method||"GET"});
  if(url.pathname.endsWith("/Login"))return response(login,"text/html",{"set-cookie":"Uralsk_SessionID=fixture; Path=/; HttpOnly"});
  assert.match(new Headers(init?.headers).get("cookie")||"",/Uralsk_SessionID=fixture/);
  if(url.pathname.includes("/res/login/index/"))return response(script,"application/javascript");
  if(url.pathname.endsWith("/LogOn")){
   assert.equal(init?.method,"POST");const form=init?.body as URLSearchParams;
   assert.equal(form.get("login"),"000000000001");assert.equal(form.get("password"),"synthetic-test-only");
   assert.equal(form.get("__RequestVerificationToken"),"synthetic-csrf");
   return response(JSON.stringify({success:true,data:{url:"/root"}}),"application/json",{"set-cookie":"auth=synthetic-session; Path=/; HttpOnly"});
  }
  assert.equal(url.pathname,"/root");assert.match(new Headers(init?.headers).get("cookie")||"",/auth=synthetic-session/);
  return response(authenticated+'<a href="/fixture/grades">Оценки</a>');
 };
 const http=new SmsHttp(config(),[],transport);const page=await loginSms(http,"000000000001","synthetic-test-only");
 assert.match(page.body,/IsAuthenticated/);assert.equal(requests.length,4);assert.equal(http.cookies.length,2);
});
test("SMS bad credentials, 2FA/CAPTCHA, unverified scripts and false success fail safely",async()=>{
 const {SmsHttp,loginSms,safeSmsError}=await apiPromise;
 for(const [result,expected]of [[{success:false},"bad_credentials"],[{success:false,data:"TwoFactorAuth"},"interactive_required"],[{success:false,data:{captchaType:2}},"interactive_required"],[{success:true,data:{url:"https://evil.test"}},"sms_changed"],[{success:true,data:{url:"/root"}},"bad_credentials"]]as const){
  const transport:typeof fetch=async input=>{const path=new URL(String(input)).pathname;return path.endsWith("/Login")?response(login):path.includes("/res/")?response(script,"text/javascript"):path.endsWith("/LogOn")?response(JSON.stringify({...result,message:"PRIVATE PROVIDER TEXT"}),"application/json"):response(login);};
  try{await loginSms(new SmsHttp(config(),[],transport),"000000000001","synthetic");assert.fail("must reject");}
  catch(error){assert.equal(safeSmsError(error),expected);assert.ok(!String(error).includes("PRIVATE"));}
 }
 const changed:typeof fetch=async input=>new URL(String(input)).pathname.endsWith("/Login")?response(login):response("new unknown login client","text/javascript");
 await assert.rejects(loginSms(new SmsHttp(config(),[],changed),"000000000001","synthetic"),{code:"sms_changed"});
});
test("SMS URL allowlist, redirects, byte limits, content types and timeout",async()=>{
 const {SmsHttp,safeSmsUrl}=await apiPromise;
 for(const url of ["https://evil.test","//evil.test/","https://sms.ura.nis.edu.kz@evil.test/","https://u:p@sms.ura.nis.edu.kz/","http://sms.ura.nis.edu.kz/","file:///etc/passwd","javascript:alert(1)","https://sms.ura.nis.edu.kz:444/"])assert.throws(()=>safeSmsUrl(url,origin));
 let count=0;
 const redirect:typeof fetch=async()=>{count++;return new Response(null,{status:302,headers:{location:"https://evil.test/"}});};
 await assert.rejects(new SmsHttp(config(),[],redirect).request("/root"),{code:"sms_changed"});assert.equal(count,1);
 const replay:typeof fetch=async()=>new Response(null,{status:307,headers:{location:"/root"}});
 await assert.rejects(new SmsHttp(config(),[],replay).request("/root",new URLSearchParams({password:"synthetic"})),{code:"sms_changed"});
 await assert.rejects(new SmsHttp({...config(),maxBytes:3},[],async()=>response("too long")).request("/root"),{code:"sms_changed"});
 await assert.rejects(new SmsHttp(config(),[],async()=>response("raw","application/octet-stream")).request("/root"),{code:"sms_changed"});
 await assert.rejects(new SmsHttp(config(),[],async()=>response("x","text/html",{"set-cookie":"bad=x; Domain=evil.test"})).request("/root"),{code:"sms_changed"});
 const stall:typeof fetch=async(_input,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener("abort",()=>reject(new Error("PRIVATE"))));
 await assert.rejects(new SmsHttp(config(),[],stall).request("/root"),{code:"timeout"});
});
test("SMS cookie paths, deletions and expiration stay scoped",async()=>{
 const {SmsHttp}=await apiPromise;let cookie="";
 const http=new SmsHttp(config(),[{name:"private",value:"synthetic",path:"/root",expires:Date.now()+10000},{name:"expired",value:"synthetic",path:"/",expires:0}],async(_url,init)=>{cookie=new Headers(init?.headers).get("cookie")||"";return response("ok","text/html",{"set-cookie":"private=; Path=/root; Max-Age=0"});});
 await http.request("/rooted");assert.equal(cookie,"");assert.equal(http.cookies.some(c=>c.name==="private"),false);
});
test("SMS AES-GCM is randomized, user-bound, tamper-resistant and hard-expiring",async()=>{
 const {sealSession,openSession,SMS_MAX_AGE_MS}=await apiPromise;const key=randomBytes(32),now=Date.now(),session={version:1 as const,expires:now+SMS_MAX_AGE_MS-1000,cookies:[{name:"auth",value:"synthetic-session",path:"/"}]};
 const sealed=sealSession(session,key,"user-a");assert.notEqual(sealed,sealSession(session,key,"user-a"));assert.ok(!sealed.includes("synthetic-session"));assert.deepEqual(openSession(sealed,key,"user-a",now),session);
 assert.throws(()=>openSession(sealed,key,"user-b",now),{code:"session_expired"});
 assert.throws(()=>openSession(sealed,randomBytes(32),"user-a",now),{code:"session_expired"});
 assert.throws(()=>openSession(sealed.slice(0,30)+(sealed[30]==="A"?"B":"A")+sealed.slice(31),key,"user-a",now),{code:"session_expired"});
 assert.throws(()=>openSession(sealed,key,"user-a",session.expires),{code:"session_expired"});
});
test("SMS config is server-only and missing/weak/wrong-origin configuration fails closed",async()=>{
 const {smsConfig,validCredentials,safeSmsError}=await apiPromise;const env={SMS_DIARY_ENABLED:"true",SMS_SESSION_SECRET:randomBytes(32).toString("base64")};
 assert.equal(smsConfig(env).origin,origin);
 for(const override of [{SMS_DIARY_ENABLED:"false"},{SMS_SESSION_SECRET:"short"},{SMS_BASE_URL:"https://evil.test"},{SMS_LOGIN_PATH:"//evil.test"},{SMS_REQUEST_TIMEOUT_MS:"Infinity"}])assert.throws(()=>smsConfig({...env,...override}),{code:"feature_disabled"});
 assert.equal(validCredentials("000000000001","synthetic"),true);
 for(const iin of ["123","not-an-iin","0000000000012","000000000001\n"])assert.equal(validCredentials(iin,"synthetic"),false);
 assert.equal(safeSmsError(new Error("password=PRIVATE")),"sms_unavailable");
});
test("SMS semantic parser: nested markup/NBSP, dates, decimal commas, SOR/SOCH, missing and official vs derived",()=>{
 const parsed=parseGrades(grades,new Date("2026-09-20T12:00:00Z"));assert.equal(parsed.subjects.length,3);
 const math=parsed.subjects[0];assert.equal(math.percent,undefined);assert.equal(math.assessments[0].type,"soch");assert.equal(math.assessments[0].percentSource,"official_display");
 assert.equal(math.assessments[1].score,13);assert.equal(math.assessments[1].max,16);assert.equal(math.assessments[1].percent,81.3);assert.equal(math.assessments[1].percentSource,"derived");
 assert.equal(parsed.subjects[1].percent,72.5);assert.equal(parsed.subjects[2].assessments[0].score,undefined);assert.equal(parsed.subjects[2].assessments[0].type,undefined);
 for(const html of ["<div>Unknown ExtJS grade view</div>",grades.replace("13&nbsp;/&nbsp;16","20/16"),grades.replace("18.09.2026","31.02.2026")])assert.throws(()=>parseGrades(html));
 assert.deepEqual(gradeFilters('<label for="year">Учебный год</label><select name="actualYear" id="year"><option value="source-id">2026–2027</option></select>'),[{name:"actualYear",label:"year",options:[{value:"source-id",label:"2026–2027"}]}]);
});
test("SMS live grade mapping fails closed until verified; expired sessions are distinguished",async()=>{
 const {SmsHttp,fetchDiary}=await apiPromise;
 const http=new SmsHttp(config(),[],async()=>{assert.fail("Unverified grade URLs must not be requested");});
 await assert.rejects(fetchDiary(http,{url:new URL(origin+"/root"),body:authenticated+grades}),{code:"sms_changed"});
 await assert.rejects(fetchDiary(new SmsHttp(config(),[],async()=>response(login))),{code:"session_expired"});
 await assert.rejects(fetchDiary(new SmsHttp(config()),{url:new URL(origin+"/root"),body:authenticated}),{code:"sms_changed"});
});
test("SMS encrypted overflow: additive migration, own-only RLS, bounded storage, TTL and no anon access",async()=>{
 const db=await v051Database();
 try{
  await db.exec(`insert into auth.users(id) values('${fixtureId(1)}'),('${fixtureId(2)}');`);
  await asUser(db,fixtureId(1));const cipher="v1."+ "x".repeat(80);
  await db.query("select save_sms_session($1,now()+interval '20 minutes')",[cipher]);
  assert.equal((await db.query("select * from sms_sessions")).rows.length,1);
  await db.query("select save_sms_session($1,now()+interval '10 minutes')",[cipher]);
  assert.equal((await db.query("select * from sms_sessions")).rows.length,1);
  await assert.rejects(db.query("select save_sms_session($1,now()+interval '31 minutes')",[cipher]));
  await assert.rejects(db.query("select save_sms_session($1,now()+interval '10 minutes')",["v1."+"x".repeat(40000)]));
  await assert.rejects(db.exec("update sms_sessions set ciphertext='bad'"));
  await asUser(db,fixtureId(2));assert.equal((await db.query("select * from sms_sessions")).rows.length,0);
  await db.exec("delete from sms_sessions");await asUser(db,fixtureId(1));assert.equal((await db.query("select * from sms_sessions")).rows.length,1);
  await db.exec("reset role; update sms_sessions set created_at=now()-interval '2 hours',expires_at=now()-interval '100 minutes'");await asUser(db,fixtureId(1));assert.equal((await db.query("select * from sms_sessions")).rows.length,0);
  await asUser(db,null);await assert.rejects(db.query("select * from sms_sessions"));await assert.rejects(db.query("select save_sms_session($1,now()+interval '10 minutes')",[cipher]));
 }finally{await db.close();}
});
test("Library egg is hidden even by title; normalized secret only reveals already-accessible egg",()=>{
 const books=[{id:"normal",title:"Physics",grade:9,subject_id:"physics"},{id:"egg",title:HIDDEN_BOOK_TITLE,grade:11,subject_id:"literature"}],base={grade:"",subject:"",q:""};
 for(const q of ["",HIDDEN_BOOK_TITLE,"Проза","Tamerlane","ниш"])assert.ok(!filterBooks(books,{...base,q}).some(b=>b.id==="egg"));
 for(const q of ["ниш хабчик"," НИШ   ХАБЧИК ","ниш\u00a0хабчик","ниш\nхабчик"])assert.deepEqual(filterBooks(books,{q,grade:"9",subject:"physics"}).map(b=>b.id),["egg"]);
 assert.equal(normalizeLibrarySecret(" Ё "),"е");assert.deepEqual(filterBooks(books.slice(0,1),{...base,q:"ниш хабчик"}),[]);
});
