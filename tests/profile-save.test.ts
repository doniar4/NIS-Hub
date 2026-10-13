import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

async function profileAction(options: { missing?: boolean; wrongBio?: boolean; failedRead?: boolean; duplicate?: boolean } = {}) {
  const fixtures: Record<string,string> = {
    '@/lib/i18n-server': 'export async function getI18n(){return {locale:"ru",t:{invalidInput:"invalid",saveError:"save error",sessionError:"session",profileSaved:"saved"}}}',
    '@/lib/auth': 'export async function actionContext(){return {user:{id:"viewer-id"},supabase:globalThis.db}}',
    'next/cache': 'export function revalidatePath(...args){globalThis.revalidations.push(args)}',
  };
  const source = await build({ entryPoints:['src/app/actions/profile.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'boundary',setup(api){
    api.onResolve({filter:/.*/},args=>args.path in fixtures?{path:args.path,namespace:'fixture'}:undefined);
    api.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:fixtures[args.path],loader:'js'}));
  }}] });
  const revalidations: unknown[]=[];
  const db = {
    rpc:async()=>({error: options.duplicate ? {code:'23505'} : null}),
    from(table: string) {
      assert.ok(['profiles','profile_top_subjects'].includes(table));
      return {select(){return this;},eq(_column:string,id:string){assert.equal(id,'viewer-id');return this;},
        async single(){return { data: options.missing?null:{display_name:'Ученик',class_id:null,bio:options.wrongBio?'old':'Новый текст'},error:options.missing||options.failedRead?{}:null };},
        async order(){return {data:[],error:null};}};
    },
  };
  const mod={exports:{} as {saveProfile:(state:unknown,form:FormData)=>Promise<{error?:string;success?:string}>}};
  runInNewContext(source.outputFiles[0].text,{module:mod,exports:mod.exports,db,revalidations,require});
  const form=new FormData(); form.set('display_name','Ученик');form.set('class_id','');form.set('bio','Новый текст');
  return {result:await mod.exports.saveProfile({},form),revalidations};
}
test('profile action confirms persisted values and refreshes every profile-dependent layout',async()=>{
  const saved=await profileAction(); assert.equal(saved.result.success,'saved'); assert.deepEqual(saved.revalidations.map(v=>Array.from(v as unknown[])),[['/','layout']]);
  for(const options of [{missing:true},{wrongBio:true},{failedRead:true}]) {
    const attempt=await profileAction(options); assert.equal(attempt.result.error,'save error'); assert.equal(attempt.revalidations.length,0);
  }
  assert.ok((await profileAction({duplicate:true})).result.error?.includes('имя'));
});
