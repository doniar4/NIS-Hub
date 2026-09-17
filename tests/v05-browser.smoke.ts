import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync,mkdirSync} from "node:fs";
import {createServer} from "node:http";
import {once} from "node:events";
import {resolve,join} from "node:path";
import {build} from "esbuild";
import {chromium,webkit,expect} from "@playwright/test";
import {v05Database} from "./helpers/v05-database";
import {asUser,fixtureId as id} from "./helpers/database";
import {persistTicketThenNotify} from "../src/lib/support";
import {themeBootstrap} from "../src/lib/theme";
import {experienceBootstrap} from "../src/lib/experience";
import {dictionaries} from "../src/lib/i18n";
import {v05Copy} from "../src/lib/v05-copy";
const artifacts="/private/tmp/nis-v05-browser-results";
test("v0.5 Chromium/WebKit shell, school-day gaps and support with real isolated PostgreSQL RPCs",{timeout:180000},async t=>{
 const bundle=await build({entryPoints:[resolve("tests/browser/v05-harness.tsx")],bundle:true,write:false,platform:"browser",format:"esm",jsx:"automatic",logLevel:"silent",
 define:{"process.env":JSON.stringify({NODE_ENV:"production"})},plugins:[{name:"test-routing-boundary",setup(api){
 api.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"fixture"}));
 api.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:'export function usePathname(){return window.location.pathname;}',loader:"js"}));
 }}]});
 const css=readdirSync(".next/static/css").filter(n=>n.endsWith(".css")).map(n=>readFileSync(join(".next/static/css",n),"utf8")).join("\n");
 const requests:string[]=[],db=await v05Database();let student=id(2),notificationAttempts=0;
 await db.exec("insert into auth.users(id) values ('"+id(1)+"'),('"+id(2)+"'),('"+id(4)+"');update public.profiles set role='admin' where id='"+id(1)+"';");
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url!,"http://fixture.invalid");requests.push(req.method+" "+url.pathname);res.setHeader("Cache-Control","no-store");
  try{
  if(url.pathname==="/bundle.js"){res.setHeader("Content-Type","application/javascript");res.end(bundle.outputFiles[0].contents);return;}
  if(url.pathname==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css);return;}
  if(url.pathname==="/favicon.ico"){res.statusCode=204;res.end();return;}
  if(url.pathname==="/fixture/ticket"){
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());
   await asUser(db,body.admin?id(1):student);let ticketId=body.id;
   if(body.kind==="create")ticketId=await persistTicketThenNotify(async()=>(await db.query<{id:string}>("select public.create_support_ticket($1,$2,$3) as id",[body.category,body.title,body.description])).rows[0].id,async()=>{notificationAttempts++;throw new Error("Synthetic notification outage");});
   if(body.kind==="reply")await db.query("select public.reply_support_ticket($1,$2)",[ticketId,body.body]);
   if(body.kind==="status")await db.query("select public.set_support_status($1,$2)",[ticketId,body.status]);
   const ticket=(await db.query("select * from public.support_tickets where id=$1",[ticketId])).rows[0];
   const messages=(await db.query("select * from public.support_messages where ticket_id=$1 order by created_at desc",[ticketId])).rows;
   const events=(await db.query("select * from public.support_status_events where ticket_id=$1 order by created_at desc",[ticketId])).rows;
   res.setHeader("Content-Type","application/json");res.end(JSON.stringify({ticket,messages,events}));return;
  }
  res.setHeader("Content-Type","text/html;charset=utf-8");res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>'+themeBootstrap+';'+experienceBootstrap+'</script><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  }catch{res.statusCode=400;res.end(JSON.stringify({error:"Synthetic request rejected"}));}
 });
 server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert.ok(address&&typeof address!=="string");const origin="http://127.0.0.1:"+address.port;
 mkdirSync(artifacts,{recursive:true});
 try{for(const [name,engine]of [["chromium",chromium],["webkit",webkit]] as const){
 student=id(name==="chromium"?2:4);const browser=await engine.launch({headless:true});
 try{
 await t.test(name+": desktop collapse, themes, school-day gaps/locales, responsive drawer and no navigation requests",async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(origin+"/");await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading",{name:"Hello, Amina"})).toBeVisible();
  await expect(page.locator(".home-timetable time")).toHaveAttribute("dateTime","2026-09-18");
  const start=requests.length;
  await page.getByRole("button",{name:"Next school day",exact:true}).click();
  await expect(page.locator(".home-timetable time")).toHaveAttribute("dateTime","2026-09-28");
  await expect(page.locator(".calendar-notice")).toContainText("Weekend");
  await expect(page.locator(".calendar-notice")).toContainText("Vacation: Autumn break");
  await expect(page.locator(".calendar-notice li")).toHaveCount(3);
  await expect(page.getByRole("heading",{name:"Previewing another day",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Previous school day",exact:true}).click();
  await expect(page.locator(".home-timetable time")).toHaveAttribute("dateTime","2026-09-18");
  assert.deepEqual(requests.slice(start),[]);
  await page.getByRole("button",{name:"Collapse sidebar",exact:true}).click();
  await expect(page.locator("html")).toHaveAttribute("data-sidebar","collapsed");
  await expect(page.locator(".app-sidebar .sidebar-link").first()).toHaveAccessibleName("Home");
  await page.reload({waitUntil:"networkidle"});await expect(page.locator("html")).toHaveAttribute("data-sidebar","collapsed");
  await page.getByRole("button",{name:"Expand sidebar",exact:true}).click();
  await expect(page.locator(".app-sidebar")).toHaveCSS("width","248px");
  await page.getByRole("radio",{name:"Dark",exact:true}).check();await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.screenshot({animations:"disabled",path:join(artifacts,name+"-home-dark-desktop.png"),fullPage:true});
  for(const locale of ["ru","kk","en"] as const){
   const old=dictionaries[(await page.locator("html").getAttribute("lang")) as "ru"|"kk"|"en"];
   await page.getByRole("combobox",{name:old.locale,exact:true}).selectOption(locale);
   await page.getByRole("button",{name:v05Copy(locale).next,exact:true}).click();
   await expect(page.locator(".calendar-notice")).toContainText(v05Copy(locale).dayTypes.vacation);
   await page.getByRole("button",{name:v05Copy(locale).backToday,exact:true}).click();
  }
  await page.getByRole("radio",{name:"Light",exact:true}).check();
  await page.getByRole("radio",{name:"System",exact:true}).check();await page.emulateMedia({colorScheme:"dark"});await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.setViewportSize({width:390,height:844});await page.getByRole("button",{name:"Menu",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Menu",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Close menu",exact:true}).focus();await page.keyboard.press("Shift+Tab");
  assert.ok(await page.evaluate(()=>!!document.activeElement?.closest("dialog")));
  await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).not.toBeVisible();await expect(page.getByRole("button",{name:"Menu",exact:true})).toBeFocused();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({animations:"disabled",path:join(artifacts,name+"-home-mobile.png"),fullPage:true});
  await page.goto(origin+"/?today=2026-09-22");await expect(page.getByRole("heading",{name:"No lessons today",exact:true})).toBeVisible();
  await expect(page.locator(".home-timetable")).toContainText("Vacation: Autumn break");await expect(page.locator(".timetable-row")).toHaveCount(0);
  await page.getByRole("button",{name:"Show nearest school day",exact:true}).click();await expect(page.locator(".home-timetable time")).toHaveAttribute("dateTime","2026-09-28");
  await page.goto(origin+"/schedule?today=2026-09-22");await expect(page.getByRole("tabpanel")).toContainText("Non-school day");await expect(page.locator(".timetable-row")).toHaveCount(0);
  await page.goto(origin+"/admin");await expect(page.locator(".dashboard-card")).toHaveCount(7);await expect(page.getByText("Open tickets: 2",{exact:false})).toBeVisible();
  await page.screenshot({animations:"disabled",path:join(artifacts,name+"-admin-mobile.png"),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto(origin+"/versions");await expect(page.locator(".room-change").first()).toContainText("305 → 307");
  await page.getByRole("searchbox",{name:"Search the library",exact:true}).fill("Physics");await page.getByRole("button",{name:"Search",exact:true}).click();
  await page.waitForURL("**/library?q=Physics");await expect(page.getByRole("searchbox",{name:"Title",exact:true})).toHaveValue("Physics");
  await page.waitForLoadState("networkidle");const mark=requests.length;await page.getByRole("searchbox",{name:"Title",exact:true}).fill("NO MATCH");await expect(page.getByRole("heading",{name:"No materials found",exact:true})).toBeVisible();assert.deepEqual(requests.slice(mark),[]);
  await page.emulateMedia({reducedMotion:"reduce"});await page.goto(origin+"/");assert.equal(await page.locator("html").getAttribute("data-intro"),null);
  await page.getByRole("radio",{name:"Dark",exact:true}).check();assert.equal(await page.locator(".theme-indicator").evaluate(el=>el.getAnimations().length),0);
  await page.getByRole("radio",{name:"Light",exact:true}).check();await page.setViewportSize({width:1440,height:1000});await page.screenshot({animations:"disabled",path:join(artifacts,name+"-home-light-desktop.png"),fullPage:true});
  assert.deepEqual(errors,[]);await page.close();
 });
 await t.test(name+": ticket saves during notification failure; real RPC admin reply/status renders to owner",async()=>{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(origin+"/support");await page.getByRole("textbox",{name:"Title",exact:true}).fill("Harmless test");
  await page.getByRole("textbox",{name:"Description",exact:true}).fill("Test description only");
  const before=notificationAttempts;await page.getByRole("button",{name:"Send",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Harmless test",exact:true})).toBeVisible();assert.equal(notificationAttempts,before+1);
  await page.getByRole("textbox",{name:"Message",exact:true}).fill("Student follow-up");await page.getByRole("button",{name:"Reply",exact:true}).click();await expect(page.getByText("Student follow-up",{exact:true})).toBeVisible();
  await page.getByRole("checkbox",{name:"Fixture admin session"}).check();
  await page.getByRole("textbox",{name:"Message",exact:true}).fill("Administrator answer");await page.getByRole("button",{name:"Reply",exact:true}).click();await expect(page.getByText("Administrator answer",{exact:true})).toBeVisible();
  await page.getByRole("combobox",{name:"Status",exact:true}).selectOption("resolved");await page.getByRole("button",{name:"Status",exact:true}).click();
  await expect(page.getByText("Open → Resolved",{exact:false})).toBeVisible();
  await page.getByRole("checkbox",{name:"Fixture admin session"}).uncheck();await expect(page.getByRole("textbox",{name:"Message",exact:true})).toHaveCount(0);
  await expect(page.getByText("Administrator answer",{exact:true})).toBeVisible();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({animations:"disabled",path:join(artifacts,name+"-ticket-mobile.png"),fullPage:true});assert.deepEqual(errors,[]);await page.close();
 });
 }finally{await browser.close();}
 }}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});
