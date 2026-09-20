import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync,mkdirSync} from "node:fs";
import {join,basename} from "node:path";
import {createServer} from "node:http";
import {once} from "node:events";
import {build} from "esbuild";
import {chromium,webkit,expect} from "@playwright/test";
import {smsCopy} from "../src/lib/sms/copy";
import {parseGrades} from "../src/lib/sms/parser";
import {themeBootstrap} from "../src/lib/theme";
const snapshot=parseGrades(readFileSync("tests/fixtures/sms/grades-semantic.html","utf8"),new Date("2026-09-20T12:00:00Z"));
test("v055 Chromium/WebKit: live UI states, no credential persistence, no polling, responsive themes/locales, sidebar and egg",{timeout:240000},async t=>{
 const bundle=await build({entryPoints:["tests/browser/v055-harness.tsx"],bundle:true,write:false,format:"esm",platform:"browser",jsx:"automatic",define:{"process.env":JSON.stringify({NODE_ENV:"production"})},plugins:[{name:"sms-boundary",setup(b){
 b.onResolve({filter:/^@\/app\/actions\/sms$/},()=>({path:"actions",namespace:"fixture"}));
 b.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"fixture"}));
 b.onLoad({filter:/.*/,namespace:"fixture"},a=>({contents:a.path==="navigation"?'export const usePathname=()=>location.pathname;':'const call=async(name,form)=>(await fetch("/rpc",{method:"POST",body:JSON.stringify({name,mode:new URLSearchParams(location.search).get("mode"),fields:form?[...form.keys()]:[]})})).json();export const connectSms=form=>call("connect",form);export const refreshSms=()=>call("refresh");export const disconnectSms=()=>call("disconnect");'}));
 }}]});
 const css=readdirSync(".next/static/css").filter(n=>n.endsWith(".css")).map(n=>readFileSync(join(".next/static/css",n),"utf8")).join("\n");
 const calls:{name:string;fields:string[]}[]=[];
 const server=createServer(async(req,res)=>{
 const path=new URL(req.url!,"http://localhost").pathname;res.setHeader("Cache-Control","no-store");
 if(path==="/bundle.js"){res.setHeader("Content-Type","application/javascript");res.end(bundle.outputFiles[0].contents);return;}
 if(path==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css);return;}
 if(path.endsWith(".woff2")){try{res.end(readFileSync(join(".next/static/media",basename(path))));}catch{res.statusCode=404;res.end();}return;}
 if(path==="/favicon.ico"){res.statusCode=204;res.end();return;}
 if(path==="/rpc"){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());calls.push({name:body.name,fields:body.fields});await new Promise(resolve=>setTimeout(resolve,150));
 res.setHeader("Content-Type","application/json");res.end(JSON.stringify(body.name==="disconnect"?{connected:false}:body.mode==="bad"?{connected:false,error:"bad_credentials"}:body.mode==="changed"?{connected:true,error:"sms_changed"}:body.mode==="expired"?{connected:false,error:"session_expired"}:{connected:true,snapshot}));return;}
 res.setHeader("Content-Type","text/html;charset=utf-8");res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>'+themeBootstrap+'</script><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
 });
 server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert.ok(address&&typeof address!=="string");const origin="http://127.0.0.1:"+address.port;
 const dir="test-results/sms-ui";mkdirSync(dir,{recursive:true});
 try{for(const [engineName,engine]of (process.env.NIS_BROWSER_ENGINE==="webkit"?[["webkit",webkit]]as const:[["chromium",chromium],["webkit",webkit]]as const)){
 const browser=await engine.launch({headless:true});
 try{const page=await browser.newPage({viewport:{width:1280,height:900}});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin+"/diary?mode=bad");await page.locator("#sms-iin").fill("000000000001");await page.locator("#sms-password").fill("synthetic-not-real");await page.locator(".sms-connect form button").click();
 await expect(page.locator("#sms-password")).toHaveValue("");await expect(page.locator("#sms-iin")).toHaveValue("");await expect(page.getByRole("alert")).toHaveText(smsCopy("en").errors.bad_credentials);
 assert.deepEqual(calls.at(-1)?.fields,["iin","password"]);
 assert.ok(!page.url().includes("000000000001"));assert.ok(!await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes("synthetic-not-real")));
 await page.goto(origin+"/diary");await page.locator("#sms-iin").fill("000000000001");await page.locator("#sms-password").fill("synthetic-not-real");await page.locator(".sms-connect form button").click();
 await expect(page.locator(".sms-subject")).toHaveCount(3);await page.locator(".sms-subject summary").first().click();await expect(page.locator(".sms-assessments").first()).toContainText("SOR");
 const count=calls.length;await page.waitForTimeout(700);assert.equal(calls.length,count,"No automatic polling");
 await page.getByRole("button",{name:"Refresh",exact:true}).click();await expect(page.locator(".sms-diary")).toHaveAttribute("aria-busy","false");
 assert.equal(calls.length,count+1);
 await page.getByRole("button",{name:"Diary actions"}).click();await page.getByRole("menuitem",{name:"Disconnect SMS"}).click();await expect(page.locator("#sms-password"),JSON.stringify(calls.slice(-6))).toBeVisible();
 for(const mode of ["changed","expired","disabled"]){await page.goto(origin+"/diary?mode="+mode+(mode!=="disabled"?"&connected=1":""));await expect(page.getByRole("alert")).toBeVisible();assert.equal(await page.locator(".sms-subject").count(),0);}
 for(const locale of ["ru","kk","en"]as const)for(const width of [1280,390,320])for(const theme of ["light","dark"]){
 await page.setViewportSize({width,height:900});await page.goto(origin+"/diary?connected=1&locale="+locale);await expect(page.locator(".sms-subject")).toHaveCount(3);
 await page.evaluate(value=>{document.documentElement.dataset.theme=value;},theme);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),engineName+" "+locale+" "+width+" "+theme);
 if(locale==="ru"&&(width===320||width===1280))await page.screenshot({path:join(dir,engineName+"-"+width+"-"+theme+".png"),fullPage:true});
 }
 await page.setViewportSize({width:1280,height:900});await page.goto(origin+"/diary?connected=1");await expect(page.locator(".sms-subject")).toHaveCount(3);
 for(const zoom of [1,1.25,1.5,2]){
 await page.evaluate(z=>{document.body.style.zoom=String(z);},zoom);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),engineName+" zoom "+zoom);
 const toggle=page.locator(".sidebar-collapse");
 if(await toggle.isVisible()){
 const a=await page.locator(".sidebar-edition").boundingBox(),b=await toggle.boundingBox(),brand=await page.locator(".sidebar-brand-row").boundingBox();
 assert.ok(a&&b&&brand&&Math.abs(a.y+a.height/2-b.y-b.height/2)<2&&b.x>=a.x+a.width&&b.y>=brand.y+brand.height);
 await toggle.focus();await page.keyboard.press("Enter");await expect(toggle).toHaveAttribute("aria-expanded","false");await expect(toggle).toBeVisible();await page.keyboard.press("Enter");await expect(toggle).toHaveAttribute("aria-expanded","true");
 }}
 await page.evaluate(()=>{document.body.style.zoom="1";});
 await page.goto(origin+"/library");await expect(page.locator(".library-card")).toHaveCount(1);
 const search=page.locator('input[type="search"]').last(),requests:string[]=[];const track=(r:{url():string})=>requests.push(r.url());await page.waitForLoadState("networkidle");page.on("request",track);
 await search.fill("Проза о Tamerlane Esentaeve третем");await expect(page.locator(".library-card")).toHaveCount(0);
 await search.fill(" НИШ  ХАБЧИК ");await expect(page.locator(".library-card")).toHaveCount(1);await expect(page.locator(".library-card")).toContainText("Tamerlane");assert.deepEqual(requests,[]);page.off("request",track);
 await page.goto(origin+"/privacy?locale=ru");await expect(page.getByRole("heading",{name:"Школьный SMS-дневник · v0.5.5"})).toBeVisible();
 assert.deepEqual(errors,[]);t.diagnostic(engineName+": fixture UI, 320/390/1280, RU/KK/EN, dark/light, 100/125/150/200% CSS zoom; no live-grade claim.");
 }finally{await browser.close();}
 }}finally{server.close();await once(server,"close");}
});
