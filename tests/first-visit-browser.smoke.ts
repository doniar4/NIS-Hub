import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {chromium,expect} from "@playwright/test";
import {readFileSync,readdirSync,mkdirSync} from "node:fs";
import {join,basename} from "node:path";
import {createServer} from "node:http";
import {once} from "node:events";

test("First visit: activity waits for five persisted steps and a real reload, including client navigation",{timeout:120000},async()=>{
 const bundle=await build({entryPoints:["tests/browser/first-visit-harness.tsx"],bundle:true,write:false,platform:"browser",format:"esm",jsx:"automatic",define:{"process.env":JSON.stringify({NODE_ENV:"production"})},plugins:[{name:"activity-boundary",setup(api){
  api.onResolve({filter:/^@\/app\/actions\/profile-activity$/},()=>({path:"activity",namespace:"fixture"}));
  api.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:'export const loadProfileActivity=async()=>({today:"2026-10-13",days:[{date:"2026-10-13",count:1}]});'}));
 }}]});
 const css=readdirSync(".next/static/css",{recursive:true}).filter(n=>String(n).endsWith(".css")).map(n=>readFileSync(join(".next/static/css",String(n)),"utf8")).join("\n")+readFileSync("src/styles/profile.css","utf8");
 const server=createServer((req,res)=>{
  const url=new URL(req.url!,"http://fixture");
  if(url.pathname==="/bundle.js"){res.setHeader("Content-Type","application/javascript");res.end(bundle.outputFiles[0].contents);return;}
  if(url.pathname==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css);return;}
  if(url.pathname.endsWith(".woff2")){res.end(readFileSync(join(".next/static/media",basename(url.pathname))));return;}
  if(url.pathname==="/favicon.ico"){res.statusCode=204;res.end();return;}
  res.setHeader("Content-Type","text/html;charset=utf-8");res.end('<!doctype html><html data-theme="'+(url.searchParams.get("theme")||"light")+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
 });
 server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert.ok(address&&typeof address!=="string");
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const origin=`http://127.0.0.1:${address.port}`,activity=page.locator('#profile-activity'),guide=page.locator('.first-visit-guide');
  const out="test-results/first-visit";mkdirSync(out,{recursive:true});await page.goto(origin);
  await expect(guide).toContainText('Готово 2/5');await expect(activity).toHaveCount(0);
  await page.getByRole('link',{name:'Продолжить настройку',exact:true}).click();await expect(page).toHaveURL(/#profile-class$/);
  await page.screenshot({path:join(out,'new-profile-light.png'),fullPage:true});
  await page.getByRole('button',{name:'Complete profile',exact:true}).click();await expect(guide).toHaveCount(0);await expect(activity).toHaveCount(0);
  await page.getByRole('button',{name:'Visit library',exact:true}).click();await page.getByRole('button',{name:'Return to profile',exact:true}).click();await expect(activity).toHaveCount(0);
  await page.reload();await expect(activity).toBeVisible();
  await page.getByRole('button',{name:'Remove photo',exact:true}).click();await expect(guide).toContainText('Готово 4/5');await expect(activity).toHaveCount(0);
  await page.reload();await expect(activity).toHaveCount(0);
  await page.getByRole('button',{name:'Complete profile',exact:true}).click();await expect(activity).toHaveCount(0);await page.reload();await expect(activity).toBeVisible();
  for(const locale of ['ru','kk','en'])for(const width of [320,390,1366]){
   await page.getByRole('button',{name:'Remove photo',exact:true}).click();await page.setViewportSize({width,height:900});await page.goto(origin+'/?locale='+locale+'&theme=dark');
   await expect(guide).toBeVisible();await expect(activity).toHaveCount(0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(locale==='ru'&&width===390)await page.screenshot({path:join(out,'new-profile-mobile-dark.png'),fullPage:true});
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
