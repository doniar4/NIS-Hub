import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {runInNewContext} from "node:vm";
import {build} from "esbuild";
import {renderToStaticMarkup} from "react-dom/server";
import React from "react";
import {controlCopy,activityLabel,coarseAgent,adminPage,adminHref,adminSections} from "../src/lib/admin-control";

async function isolated<T>(entry:string,fixtures:Record<string,string>,globals:Record<string,unknown>={}){
 const sources={"server-only":"export {};",...fixtures};
 const result=await build({entryPoints:[resolve(entry)],bundle:true,write:false,platform:"node",format:"cjs",jsx:"automatic",logLevel:"silent",external:["react","react/jsx-runtime","react-dom/server","zod"],plugins:[{name:"admin-integration-boundary",setup(api){api.onResolve({filter:/.*/},a=>Object.prototype.hasOwnProperty.call(sources,a.path)?{path:a.path,namespace:"fixture"}:undefined);api.onLoad({filter:/.*/,namespace:"fixture"},a=>({contents:sources[a.path as keyof typeof sources],loader:"jsx"}));}}]});
 const mod={exports:{} as T};runInNewContext(result.outputFiles[0].text,{module:mod,exports:mod.exports,require,console,process:{env:{}},URL,URLSearchParams,AbortSignal,FormData,Buffer,setTimeout,clearTimeout,...globals});return mod.exports;
}
const auth='export async function actionContext(admin){globalThis.calls.push(["guard",admin]);if(!globalThis.authorized)throw new Error("forbidden");return {supabase:globalThis.client};}';
const i18n='export async function getI18n(){return {locale:"en"}}';
test("admin labels are complete in RU/KK/EN; events are evidence-based and never expose arbitrary routes",()=>{
 for(const locale of ["ru","kk","en"] as const){const t=controlCopy(locale);assert.deepEqual(Object.keys(t),Object.keys(controlCopy("en")));assert.ok(Object.values(t).every(v=>v.trim()));assert.equal(activityLabel("/schedule?token=must-not-render",locale),t.openedSchedule);assert.equal(activityLabel("/profile",locale),t.openedProfile);assert.equal(activityLabel("/library",locale),t.openedLibrary);assert.equal(activityLabel("/books/00000000-0000-4000-8000-000000000030/read",locale),t.openedBook);assert.equal(activityLabel("/messages",locale),t.openedCommunity);assert.equal(activityLabel("/unknown/secret",locale),t.openedSection);}
 assert.deepEqual(adminSections.map(adminHref),["/admin","/admin/users","/admin/activity","/admin/homework","/admin/schedule","/admin/content","/admin/tickets","/admin/system"]);
 assert.equal(adminPage("-1"),0);assert.equal(adminPage("1.2"),0);assert.equal(adminPage("401"),0);assert.equal(adminPage("4"),4);
});
test("coarse agent categories contain no fingerprinting/version fields",()=>{
 for(const [ua,device,browser] of [["iPhone Safari/605","iPhone/iOS","Safari"],["iPad CriOS/123","iPhone/iOS","Chrome"],["Android Chrome/122","Android","Chrome"],["Macintosh Firefox/1","Mac","Firefox"],["Windows Chrome/123 Edg/123","Windows","Edge"],["iPhone FxiOS/23","iPhone/iOS","Firefox"],["unrecognized","Other","Other"]])assert.deepEqual(coarseAgent(ua),{device,browser});
 assert.deepEqual(Object.keys(coarseAgent(null)),["device","browser"]);
});
test("activity tracker absorbs a cancelled navigation action without retries and keeps its existing throttle",async()=>{
 const effects:(()=>void)[]=[],ref={current:{path:"",time:0}},calls:unknown[]=[],context={path:"/admin/users",calls};
 const component=await isolated<{ActivityTracker:()=>null}>("src/components/activity-tracker.tsx",{
  "next/navigation":'export const usePathname=()=>globalThis.path;',
  "@/app/actions/activity":'export async function recordUserActivity(...args){globalThis.calls.push(args);throw new Error("fixture-cancelled-transport");}',
 },{...context,require:(name:string)=>name==="react"?{useEffect:(fn:()=>void)=>effects.push(fn),useRef:()=>ref}:require(name),navigator:{userAgent:"fixture coarse agent"}});
 component.ActivityTracker();effects[0]();effects[0]();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(calls.length,1,"same route is throttled and a failed transport does not loop");
 assert.equal(ref.current.path,"/admin/users");
});
test("confirmed admin action enforces guard, expected role and safe errors before RPC",async()=>{
 const calls:unknown[]=[],env={authorized:true,calls,client:{rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return {error:null};}}};
 const actions=await isolated<{updateAdminUser:(s:unknown,f:FormData)=>Promise<{success?:string;error?:string}>}>("src/app/actions/admin-control.ts",{"@/lib/auth":auth,"@/lib/i18n-server":i18n,"next/cache":'export function revalidatePath(path){globalThis.calls.push(["revalidate",path]);}',"./homework":'export async function moderateHomework(){return {ok:true}}'},env);
 const form=new FormData();for(const [k,v]of Object.entries({id:"00000000-0000-4000-8000-000000000002",class:"00000000-0000-4000-8000-000000000011",role:"admin",expected:"student",confirm:"on"}))form.set(k,v);
 assert.equal((await actions.updateAdminUser({},form)).success,"Saved");assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),["guard",true]);assert.ok(JSON.stringify(calls).includes('"p_expected_role":"student"'));
 calls.length=0;form.delete("confirm");assert.ok((await actions.updateAdminUser({},form)).error);assert.equal(calls.length,0);
 form.set("confirm","on");env.client.rpc=async()=>({error:{message:"fixture-private-provider-secret"}}) as never;
 const failed=await actions.updateAdminUser({},form);assert.ok(!JSON.stringify(failed).includes("fixture-private"));
});
test("admin mutation/chart/moderation integration rejects non-admin callers and reuses homework moderation",async()=>{
 const calls:unknown[]=[],context={authorized:false,calls,client:{rpc:async()=>{calls.push("RPC");return {data:[],error:null};}}};
 const fixtures={"@/lib/auth":auth,"@/lib/i18n-server":i18n,"next/cache":"export function revalidatePath(){}"};
 const actions=await isolated<{loadAdminChart:(r:string)=>Promise<unknown>;updateAdminUser:(s:unknown,f:FormData)=>Promise<unknown>;hideAdminHomework:(s:unknown,f:FormData)=>Promise<unknown>}>("src/app/actions/admin-control.ts",fixtures,context);
 await actions.loadAdminChart("7d");assert.deepEqual(JSON.parse(JSON.stringify(calls)),[["guard",true]]);calls.length=0;await actions.loadAdminChart("999d");assert.deepEqual(calls,[]);
 const form=new FormData();form.set("id","00000000-0000-4000-8000-000000000030");await actions.hideAdminHomework({},form);assert.deepEqual(calls,[]);form.set("confirm","on");assert.ok(JSON.stringify(await actions.hideAdminHomework({},form)).includes("error"));assert.deepEqual(JSON.parse(JSON.stringify(calls)),[["guard",true]]);
 const adminCalls:unknown[]=[],admin=await isolated<typeof actions>("src/app/actions/admin-control.ts",fixtures,{authorized:true,calls:adminCalls,client:{rpc:async(name:string)=>{adminCalls.push(name);return {error:null};}}});await admin.hideAdminHomework({},form);assert.ok(adminCalls.includes("moderate_class_homework"));
});
test("admin reporting performs one guarded RPC per widget and strips raw path/UA from returned UI data",async()=>{
 const calls:string[]=[],raw={id:"event",user_id:"user",display_name:null,class_name:null,created_at:"2026-10-06T08:00:00Z",path:"/schedule?private=secret",user_agent:"iPhone Safari/605"};
 const queries=await isolated<{adminData:(key:string,filters?:unknown,locale?:string)=>Promise<unknown>}>("src/lib/admin-queries.ts",{"./auth":'export async function requireAdmin(){globalThis.calls.push("guard")}',"./queries":'export async function database(){return {rpc(name,args){globalThis.calls.push(name);return {abortSignal:async()=>({data:globalThis.data,error:null})}}}}'}, {calls,data:[raw]});
 const data=JSON.stringify(await queries.adminData("feed",{},"en"));assert.deepEqual(calls,["guard","admin_control_read"]);assert.ok(data.includes("Opened schedule"));assert.ok(!data.includes("secret"));assert.ok(!data.includes("605"));assert.ok(!data.includes("user_agent"));
});
test("server System DTO does not return provider secrets, URLs or unvalidated build metadata",async()=>{
 const system=await isolated<{adminSystemConfig:()=>unknown}>("src/lib/admin-system.ts",{}, {process:{env:{TELEGRAM_BOT_TOKEN:"123:fixture_secret_token_long_enough",TELEGRAM_WEBHOOK_SECRET:"fixture_secret_webhook_secret_long_enough",SUPABASE_SERVICE_ROLE_KEY:"sb_secret_fixture_private_service_key_long",GEMINI_API_KEY:"fixture-private-gemini",GEMINI_MODEL:"gemini-test",AI_STUDY_ENABLED:"true",VERCEL_GIT_COMMIT_SHA:"not-a-sha:fixture-secret",NIS_BUILD_TIMESTAMP:"fixture-secret"}}});
 const data=JSON.stringify(system.adminSystemConfig());for(const secret of ["fixture-private","fixture_secret","sb_secret","https://","not-a-sha"])assert.ok(!data.includes(secret));assert.ok(data.includes('"commit":null'));assert.ok(data.includes('"built":null'));
});
test("every admin route and nested data guard remains server enforced, shell is shared and Overview streams independently",async()=>{
 const files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+"/"+e.name):e.name==="page.tsx"?[dir+"/"+e.name]:[]);
 for(const file of files("src/app/admin")){
  const source=readFileSync(file,"utf8");assert.match(source,/await requireAdmin\(\)/,file);assert.doesNotMatch(source,/<SiteShell/,file);
  const componentFixtures:Record<string,string>={};for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](@\/components\/[^"']+)["']/g)){const names=match[1].split(",").map(s=>s.trim()).filter(s=>!s.startsWith("type "));componentFixtures[match[2]]=names.map(n=>`export const ${n}=()=>null;`).join("");}
  const route=await isolated<{default:(p:unknown)=>Promise<unknown>}>(file,{"@/lib/auth":'export async function requireAdmin(){throw new Error("blocked-admin");}export const requireViewer=requireAdmin;export const actionContext=requireAdmin;',"@/lib/i18n-server":i18n,"@/lib/queries":'export const database=()=>{throw new Error("data-before-guard")};export const getCatalogOptions=database;',"@/lib/calendar-queries":'export async function getNonSchoolDays(){throw new Error("data-before-guard")}',"@/app/actions/calendar":'export async function saveNonSchoolDay(){};export async function deleteNonSchoolDay(){};export async function restoreSchedule(){}',"next/cache":'export function revalidatePath(){}',"next/headers":'export async function cookies(){throw new Error("unexpected cookies")};export async function headers(){throw new Error("unexpected headers")}',"next/link":'export default function Link(){return null}',"next/navigation":'export function redirect(){throw new Error("redirect")};export function notFound(){throw new Error("404")};',...componentFixtures});
  await assert.rejects(route.default({params:Promise.resolve({id:"not-needed"}),searchParams:Promise.resolve({})}),/blocked-admin/,file);
 }
 const overview=readFileSync("src/components/admin-overview.tsx","utf8");assert.ok((overview.match(/<Suspense/g)??[]).length>=5);assert.doesNotMatch(overview,/await adminData|await database|Pageviews|dashboard-card/);
 const nav=readFileSync("src/components/admin-navigation.tsx","utf8");assert.match(nav,/from "next\/link"/);assert.match(nav,/onFocus/);assert.match(nav,/prefetch=\{intent \? null : false\}/);assert.doesNotMatch(nav,/window\.location|<a\s/);
});
test("empty registrations/activity and user fields render localized accessible fallbacks without URLs or emails",async()=>{
 const ui=await isolated<{AdminFeed:React.ComponentType<{rows:unknown[];locale:"en"}>;AdminRegistrations:React.ComponentType<{rows:unknown[];locale:"en"}>}>("src/components/admin-data-ui.tsx",{"next/link":'export default function Link({prefetch,...p}){return <a {...p}/>}',"./admin-pagination":'export function AdminPaginationLinks(){return null}'});
 for(const component of [ui.AdminFeed,ui.AdminRegistrations])assert.ok(renderToStaticMarkup(React.createElement(component,{rows:[],locale:"en"})).includes("No records yet"));
});
