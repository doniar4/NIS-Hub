import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync,readdirSync,mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { join,basename } from "node:path";
import { build } from "esbuild";
import { chromium,webkit,expect as baseExpect } from "@playwright/test";
import { v051Database } from "./helpers/v051-database";
import { asUser,fixtureId as id } from "./helpers/database";
import { themeBootstrap } from "../src/lib/theme";
import { v053Copy } from "../src/lib/v053-copy";
const expect=baseExpect.configure({timeout:15000});
const artifacts=join(process.cwd(),"test-results","community-ui");
test("v053 Chromium/WebKit: full hitboxes, zero-request filters, school days, community safety, homework, answer UI and responsive locales", {timeout:240000},async t=>{
 const methods=["findPeople","changeFriend","safetyAction","loadHomework","saveHomework","deleteHomework","loadInbox","startConversation","loadMessages","sendMessage","markConversationRead","loadNotifications","dismissNotification","reviewStudyAnswers"];
 const bundle=await build({entryPoints:["tests/browser/v053-harness.tsx"],bundle:true,write:false,platform:"browser",format:"esm",jsx:"automatic",define:{"process.env":JSON.stringify({NODE_ENV:"production"})},plugins:[{name:"isolated-boundaries",setup(api){
 api.onResolve({filter:/^(?:@\/app\/actions\/(people|community-safety|homework|study-answers)|\.\.\/\.\.\/src\/app\/actions\/people|@\/lib\/community-client)$/},()=>({path:"rpc",namespace:"fixture"}));
 api.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"fixture"}));
 api.onLoad({filter:/.*/,namespace:"fixture"},a=>({loader:"js",contents:a.path==="navigation"?'export const usePathname=()=>location.pathname;export const useRouter=()=>({refresh(){location.reload()},push(url){location.assign(url)}});':"const call=async(name,args)=>(await fetch('/rpc',{method:'POST',body:JSON.stringify({name,args})})).json();"+methods.map(name=>"export const "+name+"=(...args)=>call('"+name+"',args);").join("")}));
 }}]});
 const css=readdirSync(".next/static/css").filter(n=>n.endsWith(".css")).map(n=>readFileSync(join(".next/static/css",n),"utf8")).join("\n");
 const db=await v051Database();
 await db.exec(`insert into auth.users(id) values('${id(1)}'),('${id(2)}');update profiles set display_name='Amina' where id='${id(1)}';update profiles set display_name='Timur' where id='${id(2)}';
 insert into classes(id,name,grade) values('${id(10)}','7A',7);
 insert into subjects(id,name,name_ru,name_kz,name_en) values('${id(20)}','Math','Математика','Математика','Mathematics'),('${id(21)}','Physics','Физика','Физика','Physics');
 update profiles set class_id='${id(10)}',bio=repeat('ҰзақМәтінДлинноеОписаниеLongBio ',8);
 insert into profile_top_subjects(profile_id,subject_id,position) values('${id(2)}','${id(20)}',1),('${id(2)}','${id(21)}',2);`);
 let queue=Promise.resolve();
 const server=createServer(async(req,res)=>{
 const path=new URL(req.url!,"http://local").pathname;res.setHeader("Cache-Control","no-store");
 if(path==="/bundle.js"){res.setHeader("Content-Type","application/javascript");res.end(bundle.outputFiles[0].contents);return;}
 if(path==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css);return;}
 if(path.endsWith(".woff2")){try{res.setHeader("Content-Type","font/woff2");res.end(readFileSync(join(".next/static/media",basename(path))));}catch{res.statusCode=404;res.end();}return;}
 if(path==="/favicon.ico"){res.statusCode=204;res.end();return;}
 if(path==="/rpc"){
 const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);const request=JSON.parse(Buffer.concat(chunks).toString());
 queue=queue.then(async()=>{
 const user=String(req.headers["x-fixture-user"]??id(1));await asUser(db,user);
 const a=request.args;let result:unknown;
 const rpc=async(name:string,args:unknown[]=[])=>db.query<{value: string}>("select "+name+"("+args.map((_,i)=>"$"+(i+1)).join(",")+") value",args);
 try{
 switch(request.name){
 case "findPeople":result={data:(await db.query("select * from people_list($1,$2,$3,$4)",[a[0],a[1]??"",a[2]??null,a[3]??0])).rows};break;
 case "changeFriend":await rpc("friend_action",a);result={ok:true};break;
 case "safetyAction":{const v=a[0];if(v.action==="block"||v.action==="unblock")await rpc("set_user_block",[v.id,v.action==="block"]);else if(v.action==="hide")await rpc("set_dm_hidden",[v.id,true]);else if(v.action==="delete")await rpc("delete_own_dm",[v.id]);else if(v.action==="report")await rpc("report_community",[v.kind,v.id,v.reason,v.detail]);result={ok:true};break;}
 case "loadInbox":result={data:(await db.query("select * from dm_inbox_v053()")).rows};break;
 case "startConversation":result={id:(await rpc("start_dm",a)).rows[0].value};break;
 case "loadMessages":{const rows=(await db.query("select * from dm_history_v053($1,$2,$3)",[a[0],a[1]?.at??null,a[1]?.id??null])).rows;result={data:rows.slice(0,50).reverse(),more:rows.length>50};break;}
 case "sendMessage":result={id:(await rpc("send_dm",a)).rows[0].value};break;
 case "markConversationRead":await rpc("read_dm",a);result={ok:true};break;
 case "dismissNotification":await rpc("dismiss_notification",a);result={ok:true};break;
 case "loadNotifications":result={data:(await db.query("select * from notification_feed_v053()")).rows,unread:Number((await rpc("notification_unread_v053")).rows[0].value)};break;
 case "loadHomework":result={data:(await db.query("select * from class_homework where due_date=$1 order by created_at,id limit 20 offset $2",[a[0],a[1]??0])).rows};break;
 case "saveHomework":await rpc("save_class_homework",[a[0].subject,a[0].date,a[0].body,a[0].id]);result={ok:true};break;
 case "deleteHomework":await rpc("delete_class_homework",a);result={ok:true};break;
 case "reviewStudyAnswers":result={response:{feedback:[{index:0,status:"correct",feedback:"Supported by the source.",evidence:[{page:1,quote:"Chlorophyll absorbs light."}]}],topicsToReview:[]},source:{start:1,end:1,variantId:id(30),hash:"fixture"}};break;
 default:throw new Error("Unknown test boundary");
 }
 }catch{result={error:"unavailable"};}
 res.setHeader("Content-Type","application/json");res.end(JSON.stringify(result));
 });return;
 }
 res.setHeader("Content-Type","text/html;charset=utf-8");res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>'+themeBootstrap+'</script><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
 });
 server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert.ok(address&&typeof address!=="string");const origin="http://127.0.0.1:"+address.port;mkdirSync(artifacts,{recursive:true});
 try{
 for(const [engineName,engine]of (process.env.NIS_BROWSER_ENGINE==="chromium"?[["chromium",chromium]]as const:[["chromium",chromium],["webkit",webkit]]as const)){
 const browser=await engine.launch({headless:true,...(engineName==="chromium"&&process.env.NIS_CHROMIUM_PATH?{executablePath:process.env.NIS_CHROMIUM_PATH}:{})});
 try{const page=await browser.newPage({viewport:{width:1280,height:900}}),errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin+"/library");await expect(page.locator(".library-card")).toHaveCount(125);await page.waitForLoadState("networkidle");
 const network:string[]=[];const track=(r:{url():string})=>network.push(r.url());page.on("request",track);
 await page.locator('input[type="search"]').last().fill("Physics");await page.getByRole("combobox",{name:"Grade",exact:true}).selectOption("8");await page.getByRole("combobox",{name:"Subject",exact:true}).selectOption(id(21));
 assert.ok(page.url().includes("subject="+id(21)));await page.getByRole("button",{name:"Reset filters"}).click();assert.deepEqual(network,[]);page.off("request",track);
 const card=page.locator(".library-card").first(),box=await card.boundingBox();assert.ok(box);await card.click({position:{x:box.width-5,y:box.height-5}});await page.waitForURL(/\/books\//);
 await page.goto(origin+"/schedule");assert.equal(await page.getByText("NEVER_VISIBLE_TEACHER").count(),0);
 const tab=page.getByRole("tab").nth(1),tabBox=await tab.boundingBox();assert.ok(tabBox);await tab.click({position:{x:tabBox.width-10,y:tabBox.height-10}});await expect(tab).toHaveAttribute("aria-selected","true");await tab.press("ArrowRight");await expect(page.getByRole("tab").nth(2)).toHaveAttribute("aria-selected","true");
 const material=page.locator(".timetable-materials").first();await expect(material).toHaveAttribute("href","/library?subject="+id(20)+"&grade=7");
 await page.locator(".home-timetable").getByRole("button",{name:/Next school day/i}).click();await expect(page.locator('.home-timetable time').first()).toHaveAttribute("datetime","2026-09-21");await expect(page.locator(".calendar-notice").first()).toContainText("19");
 await page.locator(".homework-panel select").selectOption(id(20));await page.locator(".homework-panel textarea").fill("Practice exercise one");await page.locator(".homework-panel").getByRole("button",{name:"Save",exact:true}).click();await expect(page.locator(".homework-entry").first()).toContainText("Practice exercise one");

 await page.locator('.home-timetable .action-menu-trigger').first().click();
 await page.getByRole('menuitem',{name:'Add homework',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('dialog').locator('select')).toHaveCount(0);
 await expect(page.getByRole('dialog').locator('input[type=date]')).toHaveValue('2026-09-21');
 await page.getByRole('dialog').locator('textarea').fill('Quick homework from the home screen');
 await page.getByRole('dialog').locator('input[type=date]').fill('2026-09-19');
 await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('.homework-panel')).toContainText('Quick homework from the home screen');
 await page.locator('.home-timetable .action-menu-trigger').first().click();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('menu')).toHaveCount(0);
 await expect(page.locator('.home-timetable .action-menu-trigger').first()).toBeFocused();
 await page.locator('.home-timetable .action-menu-trigger').first().click();
 await page.getByRole('menuitem',{name:'Add homework',exact:true}).click();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.screenshot({path:join(artifacts,engineName+'-schedule-desktop.png'),fullPage:true});
 await page.goto(origin+"/people");await page.getByLabel("Find a student",{exact:true}).fill("tiM");await page.getByRole("button",{name:"Find a student",exact:true}).click();await expect(page.locator(".person-card")).toHaveCount(1);await page.locator(".person-card").click();
 await expect(page.getByRole("button",{name:"Add friend",exact:true})).toBeVisible();await page.getByRole("button",{name:"Add friend",exact:true}).click();await expect(page.getByText("Request sent",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Message",exact:true}).click();await page.waitForURL(/\/messages\?thread=/);
 await expect(page.locator(".conversation-heading a")).toHaveAttribute("href","/people/"+id(2)+"?thread="+new URL(page.url()).searchParams.get("thread"));
 await page.locator(".message-compose textarea").fill("First message");await page.getByRole("button",{name:"Send",exact:true}).click();await expect(page.locator(".message-history")).toContainText("First message");
 const thread=new URL(page.url()).searchParams.get("thread")!;
 const headingHeight=await page.locator('.conversation-heading').evaluate(e=>e.getBoundingClientRect().height);
 await page.locator('.conversation-heading .action-menu-trigger').click();
 await expect(page.getByRole('menu')).toBeVisible();
 assert.equal(await page.locator('.conversation-heading').evaluate(e=>e.getBoundingClientRect().height),headingHeight);
 await page.screenshot({path:join(artifacts,engineName+'-chat-menu-desktop.png')});
 await page.keyboard.press('Escape');
 await page.locator('.conversation-profile').click();
 await page.getByRole('link',{name:'Back to messages',exact:true}).click();
 await page.waitForURL(/\/messages\?thread=/);

 await page.locator(".message-own .action-menu-trigger").first().click();await page.getByRole("menuitem",{name:"Delete my message"}).click();await expect(page.locator(".message-history")).toContainText("Message deleted");
 await page.goto(origin+"/profile");await page.waitForLoadState("networkidle");
 const incoming=await page.request.post(origin+"/rpc",{headers:{"x-fixture-user":id(2)},data:{name:"sendMessage",args:[thread,"Preview from Timur "+"🧑".repeat(130),crypto.randomUUID()]}});assert.ok((await incoming.json()).id);
 await page.evaluate(()=>window.dispatchEvent(new Event("nis-notifications-change")));
 await expect(page.locator(".notification-toasts .preview-lines")).toContainText("Preview from Timur");assert.equal(Array.from(await page.locator(".notification-toasts .preview-lines").innerText()).length,120);
 await page.goto(origin+"/people/"+id(2));await page.locator(".public-profile .action-menu-trigger").click();await page.getByRole("menuitem",{name:"Block",exact:true}).click();await expect(page.getByText("No profile",{exact:true})).toBeVisible();
 await page.request.post(origin+"/rpc",{data:{name:"safetyAction",args:[{action:"unblock",id:id(2)}]}});
 // Restore friendship state between engine runs without deleting data.
 await page.request.post(origin+"/rpc",{data:{name:"changeFriend",args:[id(2),"remove"]}});
 await page.goto(origin+"/reader");await expect(page.getByRole("button",{name:"Check answers against the textbook"})).toBeDisabled();await page.getByLabel("Your answer 1").fill("Chlorophyll");await page.getByRole("button",{name:"Check answers against the textbook"}).click();await expect(page.getByText("Supported by the source.")).toBeVisible();
 // Real component layouts at all requested sizes, three locales, both themes.
 for(const locale of ["ru","kk","en"]as const)for(const width of [1280,1024,768,390,320]){
 await page.setViewportSize({width,height:900});await page.goto(origin+"/schedule?locale="+locale);
 await page.locator(`input[type="radio"][value="${width%3===0?"dark":"light"}"]`).check();
 await expect(page.locator(".day-square-btn")).toHaveCount(5);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),engineName+" overflow "+locale+" "+width);
 for(const button of await page.locator(".day-square-btn").all()){const r=await button.boundingBox();assert.ok(r&&r.width>=44&&r.height>=44);}
 if(width===320){
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.locator('.home-timetable .action-menu-trigger').first().click();
   const menu=await page.getByRole('menu').boundingBox();assert.ok(menu&&menu.x>=0&&menu.x+menu.width<=width);
   await page.getByRole('menuitem',{name:v053Copy(locale).addHomework,exact:true}).click();
   await expect(page.getByRole('dialog').locator('textarea')).toBeFocused();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   await page.screenshot({path:join(artifacts,engineName+'-homework-'+locale+'-320.png')});
   await page.keyboard.press('Escape');
   await expect(page.getByRole('dialog')).toHaveCount(0);
   await expect(page.locator('.home-timetable .action-menu-trigger').first()).toBeFocused();
   await page.emulateMedia({reducedMotion:'no-preference'});
 }

 }
 for(const path of ["/library","/people/"+id(2),"/profile","/messages","/reader","/privacy","/terms"]){
 await page.setViewportSize({width:320,height:900});await page.goto(origin+path+"?locale=kk");await page.waitForLoadState("networkidle");
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),engineName+" overflow "+path);
 await page.screenshot({path:join(artifacts,engineName+"-"+path.split("/").join("-")+"-320.png")});
 }

 await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/schedule?locale=ru');
 await page.locator('input[type=radio][value=dark]').check();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.screenshot({path:join(artifacts,engineName+'-schedule-ru-dark.png'),fullPage:true});
 await page.locator('.home-timetable .action-menu-trigger').first().click();
 await page.getByRole('menuitem',{name:v053Copy('ru').addHomework,exact:true}).click();
 await page.screenshot({path:join(artifacts,engineName+'-homework-ru-dark.png')});
 await page.keyboard.press('Escape');
 await page.goto(origin+'/people/'+id(2)+'?locale=ru');
 await page.locator('input[type=radio][value=dark]').check();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.screenshot({path:join(artifacts,engineName+'-profile-ru-dark.png'),fullPage:true});
 await page.setViewportSize({width:1280,height:900});await page.goto(origin+"/profile");await page.evaluate(()=>{document.body.style.zoom="2";});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),engineName+" 200% zoom overflow");
 await page.screenshot({path:join(artifacts,engineName+"-200-percent.png")});
 await page.evaluate(()=>{document.body.style.zoom="1";});
 const toggle=page.locator(".sidebar-toggle-row .sidebar-collapse"),brand=await page.locator(".sidebar-brand-row").boundingBox(),identity=await page.locator(".sidebar-edition").boundingBox(),toggleBox=await toggle.boundingBox();assert.ok(brand&&identity&&toggleBox&&toggleBox.y>=identity.y+identity.height-1);
 await toggle.click();await expect(page.locator("html")).toHaveAttribute("data-sidebar","collapsed");await toggle.focus();await page.keyboard.press("Enter");await expect(page.locator("html")).toHaveAttribute("data-sidebar","expanded");
 assert.equal(await page.locator(".app-sidebar nav a[href='/messages']").count(),0);assert.ok(await page.getByRole("link",{name:v053Copy("en").people,exact:true}).count());
 assert.deepEqual(errors,[]);await page.close();t.diagnostic(engineName+": layout matrix, full hitboxes, filter requests=0, real SQL community/homework; provider response fixture only.");
 }catch(error){const page=browser.contexts()[0]?.pages()[0];await page?.screenshot({path:join(artifacts,"failure.png"),fullPage:true});throw error;}finally{await browser.close();}
 }
 }finally{server.close();await once(server,"close");await db.close();}
});
