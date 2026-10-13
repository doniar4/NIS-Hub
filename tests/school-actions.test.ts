import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import type { ActionState } from "../src/lib/action-state";

test("School actions validate city-school pairs, confirm writes and complete only a persisted profile", async () => {
  const fixtures: Record<string,string> = {
    "@/lib/auth": 'export async function actionContext(){return {user:{id:"owner"},supabase:globalThis.db}}',
    "@/lib/i18n-server": 'export async function getI18n(){return {locale:"ru"}}',
    "next/cache": 'export function revalidatePath(){globalThis.revalidations++}',
    "./profile": 'export async function saveProfile(){return globalThis.profileResult}',
  };
  const compiled = await build({entryPoints:["src/app/actions/schools.ts"],bundle:true,write:false,platform:"node",format:"cjs",plugins:[{name:"boundaries",setup(api){
    api.onResolve({filter:/.*/},args=>args.path in fixtures?{path:args.path,namespace:"fixture"}:undefined);
    api.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:fixtures[args.path],loader:"js"}));
  }}]});
  let school:string|null=null, completed:string|null=null, calls=0, rpcError:{code:string}|null=null, stale=false;
  const db={
    rpc:async(name:string,args:Record<string,string>)=>{
      calls++;
      if(rpcError)return {error:rpcError};
      if(name==="save_profile_school")school=args.p_school;
      if(name==="complete_profile_onboarding")completed="2026-10-13";
      return {error:null};
    },
    from(table:string){assert.equal(table,"profiles");return {select(){return this},eq(key:string,value:string){assert.equal(key,"id");assert.equal(value,"owner");return this},async single(){return {data:{school_id:stale?null:school,onboarding_completed_at:stale?null:completed},error:null}}}},
  };
  const mod={exports:{} as {saveSchool:(input:unknown)=>Promise<ActionState>;finishSchoolOnboarding:(state:ActionState,form:FormData)=>Promise<ActionState>}};
  const context={module:mod,exports:mod.exports,require,db,revalidations:0,profileResult:{} as ActionState};
  runInNewContext(compiled.outputFiles[0].text,context);
  for(const input of [{city:"oral",school:"astana-nura"},{city:"unknown",school:"oral"},{city:"oral",school:"oral",userId:"other"}])assert.ok((await mod.exports.saveSchool(input)).error);
  assert.equal(calls,0);
  assert.ok((await mod.exports.saveSchool({city:"oral",school:"oral"})).success);assert.equal(school,"oral");
  stale=true;assert.ok((await mod.exports.saveSchool({city:"astana",school:"astana-nura"})).error);stale=false;
  rpcError={code:"PGRST202"};assert.match((await mod.exports.saveSchool({city:"oral",school:"oral"})).error!,/обновление базы/);rpcError=null;
  const before=calls;context.profileResult={error:"invalid profile"};
  assert.equal((await mod.exports.finishSchoolOnboarding({},new FormData())).error,"invalid profile");assert.equal(calls,before);
  context.profileResult={success:"saved"};assert.ok((await mod.exports.finishSchoolOnboarding({},new FormData())).success);assert.ok(completed);
  stale=true;assert.ok((await mod.exports.finishSchoolOnboarding({},new FormData())).error);
});
