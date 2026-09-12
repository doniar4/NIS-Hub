import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";
const id="00000000-0000-4000-8000-000000000030";
test("Actual signed-access route authenticates and checks published state without historical licence approval",async()=>{
  const result=await build({entryPoints:[resolve("src/app/api/books/[id]/access/route.ts")],write:false,bundle:true,platform:"node",format:"cjs",logLevel:"silent",
    plugins:[{name:"isolated-session",setup(api){
      api.onResolve({filter:/^@\/lib\/supabase\/server$/},()=>({path:"session",namespace:"fixture"}));
      api.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:"export async function createClient(){return globalThis.fixtureClient;}",loader:"js"}));
    }}]});
  let user:unknown={id:"student"},book:unknown={file_path:"books/test.pdf",publication_status:"published",license_status:"pending_review"};
  let signed=0, storageError=false;
  const client={
    auth:{getUser:async()=>({data:{user},error:null})},
    from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:book,error:null})})})}),
    storage:{from:(bucket:string)=>({createSignedUrl:async(path:string,ttl:number)=>{
      signed++;assert.equal(bucket,"book-files");assert.equal(path,"books/test.pdf");assert.equal(ttl,60);
      return storageError?{data:null,error:{message:"Sensitive provider details must not leak"}}:{data:{signedUrl:"https://fixture.invalid/private?token=synthetic"},error:null};
    }})},
  };
  const mod={exports:{} as {GET:(request:Request,context:{params:Promise<{id:string}>})=>Promise<Response>}};
  runInNewContext(result.outputFiles[0].text,{module:mod,exports:mod.exports,Response,fixtureClient:client});
  const get=()=>mod.exports.GET(new Request("https://fixture.invalid/api/books/"+id+"/access"),{params:Promise.resolve({id})});
  let response=await get();assert.equal(response.status,200);assert.equal(signed,1);assert.equal(response.headers.get("Cache-Control"),"private, no-store");assert.equal(response.headers.get("Referrer-Policy"),"no-referrer");
  user=null;response=await get();assert.equal(response.status,401);assert.equal(signed,1);
  user={id:"student"};
  for(const publication_status of ["draft","archived"]){book={file_path:"books/test.pdf",publication_status};response=await get();assert.equal(response.status,404);assert.equal(signed,1);}
  book={file_path:"https://evil.invalid/a.pdf",publication_status:"published"};response=await get();assert.equal(response.status,404);assert.equal(signed,1);
  book={file_path:"books/test.pdf",publication_status:"published"};storageError=true;response=await get();assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/Sensitive|provider|token/);
});
