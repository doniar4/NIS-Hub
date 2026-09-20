import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { v051Database } from "./helpers/v051-database";
import { asUser,fixtureId as id } from "./helpers/database";
import { sourceHash,cacheSignature,STUDY_PROMPT_VERSION } from "../src/lib/study-cache";
const text="Photosynthesis uses light energy to turn carbon dioxide and water into glucose and oxygen. Chlorophyll absorbs light.";
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
test("Actual answer-review action: verifies saved questions and owner HMAC, shares SQL quota, never persists answers",async()=>{
 const db=await v051Database(async db=>{
 await db.exec(`insert into auth.users(id) values('${id(1)}'),('${id(2)}'),('${id(3)}');update profiles set role='admin' where id='${id(1)}';
 insert into subjects(id,name) values('${id(20)}','Physics');
 insert into books(id,title,subject_id,file_path,language,publication_status) values('${id(30)}','Fixture','${id(20)}','books/fixture.pdf','ru','published');
 insert into storage.objects(bucket_id,name) values('book-files','books/fixture.pdf');`);
 });
 const originalFetch=globalThis.fetch;
 const runtime=globalThis as typeof globalThis & {__v053Action?:unknown};
 try{
 await asUser(db,id(1));
 const job=(await db.query<{j:{revision:string;job:string}}>("select begin_book_extraction($1) j",[id(30)])).rows[0].j;
 await db.query("select put_book_pages($1,$2,$3,$4)",[id(30),job.revision,job.job,JSON.stringify([{page:1,text}])]);
 await db.query("select finish_book_extraction($1,$2,$3,1,$4)",[id(30),job.revision,job.job,sha("pdf")]);
 let user=id(2);await asUser(db,user);
 const hash=sourceHash([{page_number:1,text_hash:sha(text)}]),model="gemini-test:"+STUDY_PROMPT_VERSION;
 const g=(await db.query<{r:{generation:{id:string;lease:string}}}>("select reserve_ai_study($1,$2,1,1,'questions','en',$3,$4) r",[id(30),job.revision,hash,model])).rows[0].r.generation;
 const response=JSON.stringify({insufficient:false,sections:[{kind:"questions",insufficient:false,points:[{text:"What absorbs light?",evidence:[{page:1,quote:"Chlorophyll absorbs light."}]}]}]});
 const signature=cacheSignature("fixture-only",[user,id(30),job.revision,1,1,"questions","en",hash,model],response);
 await db.query("select complete_ai_study($1,$2,$3,$4)",[g.id,g.lease,response,signature]);
 // Exercise real action code with a minimal PostgREST-shaped bridge to actual SQL/RLS.
 const bridge={
 from(table:string){
 assert.ok(["ai_study_generations","book_pages"].includes(table));
 const where:string[]=[],values:unknown[]=[],orders:string[]=[];let columns="*",limit=100;
 const q={select(v:string){columns=v;return q;},eq(k:string,v:unknown){values.push(v);where.push(k+"=$"+values.length);return q;},gte(k:string,v:unknown){values.push(v);where.push(k+">=$"+values.length);return q;},lte(k:string,v:unknown){values.push(v);where.push(k+"<=$"+values.length);return q;},order(k:string){orders.push(k);return q;},limit(v:number){limit=v;return q;},
 async run(single=false){try{const result=await db.query("select "+columns+" from "+table+(where.length?" where "+where.join(" and "):"")+(orders.length?" order by "+orders.join(","):"")+" limit "+limit,values);return {data:single?(result.rows[0]??null):result.rows,error:null};}catch{return {data:null,error:{code:"test_sql"}};}},
 maybeSingle(){return q.run(true);},then(resolve: (v:unknown)=>unknown,reject: (e:unknown)=>unknown){return q.run().then(resolve,reject);}};
 return q;
 },
 async rpc(name:string,args:Record<string,unknown>){
 assert.ok(["reserve_ai_study","complete_ai_study"].includes(name));const keys=Object.keys(args);
 try{const result=await db.query<{r:unknown}>("select "+name+"("+keys.map((k,i)=>k+"=>$"+(i+1)).join(",")+") r",Object.values(args));return {data:result.rows[0].r,error:null};}catch{return {data:null,error:{code:"test_sql"}};}
 }
 };
 runtime.__v053Action={context:()=>({supabase:bridge,user:{id:user}}),config:{enabled:true,key:"fixture-only",model:"gemini-test",maxPages:10,maxChars:30000,dailyLimit:10,timeoutMs:1000}};
 const bundle=await build({entryPoints:["src/app/actions/study-answers.ts"],bundle:true,write:false,platform:"node",format:"esm",plugins:[{name:"test-boundaries",setup(b){
 b.onResolve({filter:/^@\/lib\/(auth|ai-study-config)$/},a=>({path:a.path,namespace:"test"}));
 b.onLoad({filter:/.*/,namespace:"test"},a=>({contents:a.path.endsWith("auth")?"export async function actionContext(){return globalThis.__v053Action.context();}":"export function aiStudyConfig(){return globalThis.__v053Action.config;}",loader:"js"}));
 }}]});
 const action=await import("data:text/javascript;base64,"+Buffer.from(bundle.outputFiles[0].contents).toString("base64"));
 let calls=0,status=200;
 globalThis.fetch=async(_url,init)=>{
 calls++;const request=JSON.parse(String(init?.body)),payload=JSON.parse(request.contents[0].parts[0].text);
 assert.deepEqual(payload.pages,[{page:1,text}]);assert.equal(payload.answers[0].question,"What absorbs light?");assert.equal(payload.answers[0].answer,"UNIQUE_PRIVATE_STUDENT_ANSWER");
 assert.ok(!String(init?.body).includes(user));
 return status!==200?new Response("private provider error",{status}):Response.json({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify({feedback:[{index:0,status:"incorrect",feedback:"Review the source.",evidence:[{page:1,quote:"Chlorophyll absorbs light."}]}],topicsToReview:[]})}]}}]});
 };
 const input={generationId:g.id,answers:[{index:0,text:"UNIQUE_PRIVATE_STUDENT_ANSWER"}]};
 assert.ok((await action.reviewStudyAnswers(input)).response);assert.equal(calls,1);
 assert.equal((await db.query<{requests:number}>("select requests from ai_study_daily_usage")).rows[0].requests,2);
 const cached=await db.query<{response:string|null;model_key:string;status:string}>("select response,model_key,status from ai_study_generations");
 assert.equal(cached.rows.filter(r=>r.model_key.startsWith("answer-review")).length,1);
 assert.ok(cached.rows.filter(r=>r.model_key.startsWith("answer-review")).every(r=>r.response===null&&r.status==="failed"));
 assert.ok(!JSON.stringify(cached.rows).includes("UNIQUE_PRIVATE_STUDENT_ANSWER"));
 assert.equal((await action.reviewStudyAnswers({...input,questions:["forged"]})).error,"unavailable");
 assert.equal((await action.reviewStudyAnswers({...input,answers:[{index:1,text:"forged"}]})).error,"unavailable");assert.equal(calls,1);
 user=id(3);await asUser(db,user);assert.equal((await action.reviewStudyAnswers(input)).error,"unavailable");assert.equal(calls,1);
 user=id(2);await asUser(db,user);
 status=429;assert.equal((await action.reviewStudyAnswers(input)).error,"provider_quota");
 for(let n=0;n<7;n++)await action.reviewStudyAnswers(input);
 assert.equal((await action.reviewStudyAnswers(input)).error,"quota");
 assert.equal((await db.query<{requests:number}>("select requests from ai_study_daily_usage")).rows[0].requests,10);
 await asUser(db,id(1));await db.query("update storage.objects set updated_at=now()+interval '1 second' where name='books/fixture.pdf'");
 await asUser(db,id(2));assert.equal((await action.reviewStudyAnswers(input)).error,"unavailable");
 }finally{globalThis.fetch=originalFetch;delete runtime.__v053Action;await db.close();}
});
