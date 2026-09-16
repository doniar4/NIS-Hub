import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {v051Database} from "./helpers/v051-database";
import {asUser,fixtureId as id} from "./helpers/database";
import {sourceHash,cacheSignature,validCacheSignature} from "../src/lib/study-cache";
import {studyInput,validateStudyResponse} from "../src/lib/ai-study";
import {geminiProvider,StudyProviderError} from "../src/lib/study-provider";
const text="Photosynthesis uses light energy to turn carbon dioxide and water into glucose and oxygen. Chlorophyll absorbs light.";
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
const response={insufficient:false,sections:[{kind:"overview",insufficient:false,points:[{text:"Chlorophyll absorbs light.",evidence:[{page:1,quote:"Chlorophyll absorbs light."}]}]}]};
test("AI input/source validation rejects fabricated pages/quotes and incomplete SOR; cache binds user/source/model",()=>{
 assert.equal(studyInput.safeParse({variantId:id(30),start:1,end:11,mode:"review",locale:"ru"}).success,false);
 assert.deepEqual(validateStudyResponse(response,[{page:1,text}],"summary"),response);
 assert.throws(()=>validateStudyResponse(response,[{page:2,text}],"summary"),/citation/);
 assert.throws(()=>validateStudyResponse(response,[{page:1,text:"Unrelated"}],"summary"),/citation/);
 assert.throws(()=>validateStudyResponse(response,[{page:1,text}],"sor"),/Incomplete/);
 const serialized=JSON.stringify(response),context=[id(2),id(30),hash(text),"model"];
 const signature=cacheSignature("test-only-secret",context,serialized);
 assert.equal(validCacheSignature("test-only-secret",context,serialized,signature),true);
 for(const change of [[id(3),...context.slice(1)],[...context,"changed source"]])assert.equal(validCacheSignature("test-only-secret",change,serialized,signature),false);
 assert.equal(validCacheSignature("rotated",context,serialized,signature),false);
 assert.equal(validCacheSignature("test-only-secret",context,serialized+" ",signature),false);
 assert.notEqual(sourceHash([{page_number:1,text_hash:hash(text)}]),sourceHash([{page_number:1,text_hash:hash(text+" new")}]));
});
test("Gemini transport sends only selected text with safe headers; timeouts/quota/malformed output are bounded",async()=>{
 const input={variantId:id(30),start:1,end:1,mode:"summary" as const,locale:"ru" as const},pages=[{page:1,text}];
 let calls=0;
 const provider=geminiProvider({key:"test-key-never-browser",model:"gemini-test",timeoutMs:1000},async(url,init)=>{
  calls++;assert.ok(!String(url).includes("test-key"));assert.equal((init?.headers as Record<string,string>)["x-goog-api-key"],"test-key-never-browser");
  const request=JSON.parse(String(init?.body));
  assert.deepEqual(JSON.parse(request.contents[0].parts[0].text),{pages});
  assert.ok(!String(init?.body).includes(id(30)));assert.equal(request.tools,undefined);
  return Response.json({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify(response)}]}}]});
 });
 assert.deepEqual(await provider.generate(input,pages),response);assert.equal(calls,1);
 for(const status of [429,500])await assert.rejects(geminiProvider({key:"fixture",model:"gemini-test",timeoutMs:100},async()=>new Response("Sensitive provider body",{status})).generate(input,pages),
  (e:unknown)=>e instanceof StudyProviderError&&e.code===(status===429?"provider_quota":"failed")&&!e.message.includes("Sensitive"));
 await assert.rejects(geminiProvider({key:"fixture",model:"gemini-test",timeoutMs:10},async(_u,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener("abort",()=>reject(new Error("timeout"))))).generate(input,pages),{message:"timeout"});
 await assert.rejects(geminiProvider({key:"fixture",model:"gemini-test",timeoutMs:100},async()=>Response.json({candidates:[]})).generate(input,pages),{message:"failed"});
});
test("Real SQL: extraction once, protected pages/cache, atomic quota, failed attempts, source replacement invalidation",async()=>{
 const db=await v051Database(async db=>{
  await db.query("insert into auth.users(id) values ($1),($2),($3)",[id(1),id(2),id(3)]);
  await db.query("update public.profiles set role='admin' where id=$1",[id(1)]);
  await db.query("insert into public.subjects(id,name) values($1,'Physics')",[id(20)]);
  await db.query("insert into public.books(id,title,subject_id,file_path,language,publication_status) values($1,'Fixture',$2,'books/fixture.pdf','ru','published')",[id(30),id(20)]);
  await db.query("insert into storage.objects(bucket_id,name) values('book-files','books/fixture.pdf')");
 });
 try{
  const labels=(await db.query<{name_ru:string;name_kz:string;name_en:string}>("select name_ru,name_kz,name_en from public.subjects")).rows[0];
  assert.deepEqual(labels,{name_ru:"Физика",name_kz:"Физика",name_en:"Physics"});
  await asUser(db,id(2));await assert.rejects(db.query("select public.begin_book_extraction($1)",[id(30)]));
  await asUser(db,id(1));
  const job=(await db.query<{j:{ready:boolean;job:string;revision:string}}>("select public.begin_book_extraction($1) j",[id(30)])).rows[0].j;
  await assert.rejects(db.query("select public.begin_book_extraction($1)",[id(30)]),/progress/);
  await db.query("select public.put_book_pages($1,$2,$3,$4::jsonb)",[id(30),job.revision,job.job,JSON.stringify([{page:1,text},{page:2,text:""}])]);
  await assert.rejects(db.query("select public.finish_book_extraction($1,$2,$3,3,$4)",[id(30),job.revision,job.job,hash("fixture")]),/Incomplete/);
  await db.query("select public.finish_book_extraction($1,$2,$3,2,$4)",[id(30),job.revision,job.job,hash("fixture")]);
  assert.equal((await db.query<{j:{ready:boolean}}>("select public.begin_book_extraction($1) j",[id(30)])).rows[0].j.ready,true);
  await asUser(db,id(2));
  const pages=(await db.query<{page_number:number;text_hash:string}>("select page_number,text_hash from public.book_pages order by page_number")).rows;
  assert.equal(pages.length,2);assert.equal(pages[0].text_hash,hash(text));
  await assert.rejects(db.query("update public.book_pages set text='forged'"));
  const reserve=async(model="fixture",limit=10)=>(await db.query<{r:{state:string;generation?:{id:string;lease:string}}}>("select public.reserve_ai_study($1,$2,1,1,'summary','ru',$3,$4,$5) r",[id(30),job.revision,sourceHash(pages.slice(0,1)),model,limit])).rows[0].r;
  const first=await reserve();assert.equal(first.state,"reserved");assert.equal((await reserve()).state,"busy");
  assert.equal((await db.query<{requests:number}>("select requests from public.ai_study_daily_usage")).rows[0].requests,1);
  await asUser(db,id(3));assert.equal((await db.query("select * from public.ai_study_generations")).rows.length,0);
  assert.equal((await db.query<{ok:boolean}>("select public.complete_ai_study($1,$2,'{}',$3) ok",[first.generation!.id,first.generation!.lease,hash("signature")])).rows[0].ok,false);
  await asUser(db,id(2));
  await db.query("select public.complete_ai_study($1,$2,$3,$4)",[first.generation!.id,first.generation!.lease,JSON.stringify(response),hash("signature")]);
  assert.equal((await reserve()).state,"cached");
  for(let n=1;n<10;n++)assert.equal((await reserve("model-"+n,999)).state,"reserved");
  assert.equal((await reserve("eleventh",999)).state,"quota");
  assert.equal((await db.query<{requests:number}>("select requests from public.ai_study_daily_usage")).rows[0].requests,10);
  await assert.rejects(db.query("update public.ai_study_daily_usage set requests=0"));
  await assert.rejects(db.query("delete from public.ai_study_generations"));
  await asUser(db,id(1));await db.query("update storage.objects set updated_at=now()+interval '1 second' where name='books/fixture.pdf'");
  await asUser(db,id(2));assert.equal((await db.query("select * from public.book_pages")).rows.length,0);
  assert.equal((await db.query("select * from public.ai_study_generations")).rows.length,0);
  await assert.rejects(reserve("replaced"),/Source unavailable/);
  await asUser(db,null);await assert.rejects(db.query("select * from public.book_pages"));
  await assert.rejects(db.query("select * from public.ai_study_generations"));
 }finally{await db.close();}
});
