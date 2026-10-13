import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {chromium,expect} from "@playwright/test";
import {readFileSync,readdirSync,mkdirSync} from "node:fs";
import {join,basename} from "node:path";
import {createServer} from "node:http";
import {once} from "node:events";

test("Tasks: inclusive deadline period, presets, cancel, keyboard, responsive calendar and legal padding",{timeout:120000},async()=>{
 const bundle=await build({entryPoints:["tests/browser/task-period-harness.tsx"],bundle:true,write:false,outfile:"bundle.js",platform:"browser",format:"esm",jsx:"automatic",define:{"process.env":JSON.stringify({NODE_ENV:"production"})},plugins:[{name:"task-transport",setup(api){
  api.onResolve({filter:/^@\/app\/actions\/tasks$/},()=>({path:"tasks",namespace:"fixture"}));
  api.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:'export const savePersonalTask=async()=>({error:"failed"});export const setPersonalTaskStatus=async()=>({error:"failed"});export const toggleTaskSubtask=async()=>({error:"failed"});'}));
 }}]});
 const js=bundle.outputFiles.find(f=>f.path.endsWith(".js"))!,moduleCss=bundle.outputFiles.find(f=>f.path.endsWith(".css"))!;
 const css=readdirSync(".next/static/css",{recursive:true}).filter(n=>String(n).endsWith(".css")).map(n=>readFileSync(join(".next/static/css",String(n)),"utf8")).join("\n")+moduleCss.text;
 const server=createServer((req,res)=>{
  const url=new URL(req.url!,"http://fixture");
  if(url.pathname==="/bundle.js"){res.setHeader("Content-Type","application/javascript");res.end(js.contents);return;}
  if(url.pathname==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css);return;}
  if(url.pathname.endsWith(".woff2")){res.end(readFileSync(join(".next/static/media",basename(url.pathname))));return;}
  if(url.pathname==="/favicon.ico"){res.statusCode=204;res.end();return;}
  res.setHeader("Content-Type","text/html;charset=utf-8");res.end('<!doctype html><html data-theme="'+(url.searchParams.get("theme")||"light")+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
 });
 server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert.ok(address&&typeof address!=="string");
 const browser=await chromium.launch({headless:true});
 try{
  let page=await browser.newPage({viewport:{width:1366,height:900},timezoneId:"UTC"});
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00Z"));
  const errors:string[]=[];page.on("pageerror",e=>{errors.push(e.message);console.error(e.message);});
  const origin=`http://127.0.0.1:${address.port}`,out="test-results/task-period";mkdirSync(out,{recursive:true});
  await page.goto(origin);
  const trigger=page.locator('.task-period-picker > button');
  await trigger.click();const dialog=page.getByRole("dialog",{name:"Период дедлайнов"});
  await expect(dialog.getByRole('grid')).toHaveCount(2);
  await dialog.locator('[data-date="2026-09-30"]').click();await dialog.locator('[data-date="2026-10-03"]').click();
  await page.screenshot({path:join(out,"desktop-calendar.png"),fullPage:true});
  await dialog.getByRole("button",{name:"Применить",exact:true}).click();
  await expect(page.locator('.personal-task-row')).toHaveCount(2);
  await expect(page.locator('.personal-task-list')).toContainText("Start boundary");await expect(page.locator('.personal-task-list')).toContainText("End boundary");
  await trigger.click();await dialog.getByRole("button",{name:"Сегодня",exact:true}).click();await dialog.getByRole("button",{name:"Отмена",exact:true}).click();
  await expect(page.locator('.personal-task-row')).toHaveCount(2);await expect(trigger).toBeFocused();
  await trigger.click();await dialog.getByRole("button",{name:"Сегодня",exact:true}).click();await dialog.getByRole("button",{name:"Применить",exact:true}).click();
  await expect(page.locator('.personal-task-list')).toContainText("Today task");await expect(page.locator('.personal-task-list')).toContainText("Completed today");await expect(page.locator('.personal-task-row')).toHaveCount(2);
  await trigger.click();await dialog.locator('[data-date="2026-10-13"]').focus();await dialog.locator('[data-date="2026-10-13"]').press("ArrowRight");await expect(dialog.locator('[data-date="2026-10-14"]')).toBeFocused();await page.keyboard.press("Escape");await expect(trigger).toBeFocused();
  await page.getByRole('button',{name:'Все даты',exact:true}).click();await expect(page.locator('.personal-task-row')).toHaveCount(6);
  // Use native animation clocks for navigation/layout checks; fixed-time clock injection freezes Motion after reload.
  await page.close();page=await browser.newPage({viewport:{width:1366,height:900},timezoneId:'UTC'});page.on('pageerror',e=>errors.push(e.message));
  const layoutTrigger=()=>page.locator('.task-period-picker > button');
  for(const width of [320,390,768,1366])for(const locale of ['ru','kk','en']){
   await page.setViewportSize({width,height:900});await page.goto(origin+'/?locale='+locale+'&theme=dark');await layoutTrigger().click();
   const panel=page.getByRole('dialog');await expect(panel).toBeVisible();await expect.poll(()=>panel.locator('[data-preset]').first().evaluate(el=>getComputedStyle(el.parentElement!.parentElement!).opacity)).toBe('1');await expect.poll(async()=>{const b=await panel.boundingBox();const client=await page.evaluate(()=>document.documentElement.clientWidth);return !!b&&b.x>=0&&b.x+b.width<=client+.5;}).toBe(true);await page.waitForTimeout(400);
   const box=await panel.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width+.5,`panel within ${width}`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await expect(panel.getByRole('grid')).toHaveCount(width<728?1:2);
   if(locale==='ru'&&[390,1366].includes(width))await page.screenshot({path:join(out,`${width}-dark.png`),fullPage:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(origin);await layoutTrigger().click();await page.keyboard.press('Escape');await expect(layoutTrigger()).toBeFocused();
  await page.goto(origin+'/privacy?theme=dark');assert.ok(await page.locator('.legal-prose').evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft)>=20));await page.screenshot({path:join(out,'legal-padding.png'),fullPage:true});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
