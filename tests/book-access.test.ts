import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {runInNewContext} from "node:vm";
import {resolve} from "node:path";
const id="00000000-0000-4000-8000-000000000030",kz="00000000-0000-4000-8000-000000000031";
test("Actual signed-access route enforces logical book + edition publication and association; default links stay valid",async()=>{
 const result=await build({entryPoints:[resolve("src/app/api/books/[id]/access/route.ts")],write:false,bundle:true,platform:"node",format:"cjs",logLevel:"silent",
 plugins:[{name:"isolated-session",setup(api){api.onResolve({filter:/^@\/lib\/supabase\/server$/},()=>({path:"session",namespace:"fixture"}));api.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:"export async function createClient(){return globalThis.fixtureClient;}",loader:"js"}));}}]});
 let user:unknown={id:"student"},status="published",path="books/test.pdf",editionStatus="published",storageError=false;
 const signed:string[]=[];
 const client={auth:{getUser:async()=>({data:{user},error:null})},from:(table:string)=>{
  const filters:Record<string,unknown>={};const chain={select:()=>chain,eq:(k:string,v:unknown)=>{filters[k]=v;return chain;},order:()=>chain,limit:()=>chain,
  maybeSingle:async()=>({data:{publication_status:status},error:null}),
  then:(done:(v:unknown)=>unknown)=>Promise.resolve({data:filters.book_id===id&&editionStatus==="published"?[{id,storage_path:path},{id:kz,storage_path:"books/kz.pdf"}].filter(v=>!filters.id||v.id===filters.id):[],error:null}).then(done)};
  assert.ok(table==="books"||table==="book_variants");return chain;
 },storage:{from:(bucket:string)=>({createSignedUrl:async(file:string,ttl:number)=>{
  signed.push(file);assert.equal(bucket,"book-files");assert.equal(ttl,60);
  return storageError?{data:null,error:{message:"SECRET provider"}}:{data:{signedUrl:"https://fixture.invalid/private?token=synthetic"},error:null};
 }})}};
 const mod={exports:{} as {GET:(r:Request,c:{params:Promise<{id:string}>})=>Promise<Response>}};
 runInNewContext(result.outputFiles[0].text,{module:mod,exports:mod.exports,Response,URL,fixtureClient:client});
 const get=(variant="")=>mod.exports.GET(new Request("https://fixture.invalid/api/books/"+id+"/access"+(variant?"?variant="+variant:"")),{params:Promise.resolve({id})});
 let r=await get();assert.equal(r.status,200);assert.equal(signed[0],path);assert.equal(r.headers.get("Cache-Control"),"private, no-store");
 r=await get(kz);assert.equal(r.status,200);assert.equal(signed[1],"books/kz.pdf");
 user=null;assert.equal((await get()).status,401);user={id:"student"};
 for(status of ["draft","archived"])assert.equal((await get()).status,404);status="published";
 editionStatus="draft";assert.equal((await get()).status,404);editionStatus="published";
 assert.equal((await get("00000000-0000-4000-8000-000000000099")).status,404);
 path="https://evil.invalid/file.pdf";assert.equal((await get()).status,404);
 assert.equal(signed.length,2);
 path="books/test.pdf";storageError=true;r=await get();assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/SECRET|token|provider/);
});
