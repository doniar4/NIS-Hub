import { chromium, expect } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const root=resolve(import.meta.dirname,"..");
const origin=new URL(process.env.PROMO_ORIGIN||"https://nis-hub-ura.vercel.app").origin;
if(!["https://nis-hub-ura.vercel.app","http://localhost:3000","http://127.0.0.1:3000"].includes(origin))throw Error("Origin is not audited");
if(process.env.PROMO_DEMO_CONFIRMED!=="1")throw Error("Owner-confirmed safe demo account required: PROMO_DEMO_CONFIRMED=1");
const endpoint=new URL(process.env.PROMO_CDP_URL||"http://127.0.0.1:9336");
if(endpoint.protocol!=="http:"||!["localhost","127.0.0.1"].includes(endpoint.hostname))throw Error("CDP must stay on loopback");
const ffmpeg=process.env.FFMPEG||"/opt/homebrew/bin/ffmpeg";
const run=process.env.PROMO_RESUME?resolve(process.env.PROMO_RESUME):join(root,"promo/assets",new Date().toISOString().replace(/[:.]/g,"-"));
if(!run.startsWith(join(root,"promo/assets")+"/"))throw Error("Resume must be inside promo/assets");
await mkdir(run,{recursive:true});
const logs=process.env.PROMO_RESUME?JSON.parse(await readFile(join(run,"route-log.json"),"utf8")):[];
let stage="initialization";
async function log(value){logs.push({...value,at:new Date().toISOString()});await writeFile(join(run,"route-log.json"),JSON.stringify(logs,null,2));console.log(JSON.stringify(value));}
function ff(args){const r=spawnSync(ffmpeg,["-hide_banner","-loglevel","error",...args],{encoding:"utf8"});if(r.status!==0)throw Error("ffmpeg recording failed: "+r.stderr.slice(-500));}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.connectOverCDP(endpoint.href);
let page;
for(const context of browser.contexts())for(const candidate of context.pages()){
 if(candidate.url().startsWith(origin)&&await candidate.locator(".app-sidebar").count())page=candidate;
}
if(!page)throw Error("No verified, already-authenticated demo tab found");
const returnUrl=page.url();
const publicContext=await browser.newContext({viewport:{width:1920,height:1080},locale:"ru-RU",colorScheme:"light"});
const publicPage=await publicContext.newPage();
await page.setViewportSize({width:1920,height:1080});
for(const p of [page,publicPage])p.setDefaultTimeout(20000);
const scenes=process.env.PROMO_RESUME?JSON.parse(await readFile(join(run,"checkpoint.json"),"utf8")):[];
async function go(p,route,selector){
 stage="navigate "+route;await p.bringToFront();
 await log({event:"navigate",origin,route});
 await p.goto(origin+route,{waitUntil:"domcontentloaded",timeout:60000});
 await expect(p.locator(selector).first()).toBeVisible({timeout:45000});
 if(new URL(p.url()).pathname!==new URL(origin+route).pathname)throw Error("Unexpected route/redirect");
 await p.waitForTimeout(1400);
 await log({event:"route-ready",route});
}
async function theme(p,value){
 stage="theme "+value;await p.bringToFront();
 if(await p.locator('.theme-switch input[value="'+value+'"]').isChecked())return;
 await expect(p.locator(".theme-switch")).toBeEnabled();
 await p.locator(".theme-switch label").filter({has:p.locator('input[value="'+value+'"]')}).click();
 await expect(p.locator("html")).toHaveAttribute("data-theme",value);
}
async function locale(p,value,title){
 stage="locale "+value;await p.bringToFront();
 if(await p.locator('.public-locale-options button[lang="'+value+'"]').getAttribute("aria-pressed")==="true"){await expect(p.locator("h1")).toHaveText(title);return;}
 await p.locator('.public-locale-options button[lang="'+value+'"]').click();
 await expect(p.locator("h1")).toHaveText(title);
}
async function bounds(p,selector){
 const box=await p.locator(selector).first().boundingBox();
 if(!box)throw Error("Expected capture region absent: "+selector);
 const x=Math.ceil(box.x),y=Math.max(0,Math.ceil(box.y));
 return {x,y,width:Math.floor(Math.min(box.width,1920-x)),height:Math.floor(Math.min(box.height,1080-y-8))};
}
async function protect(p,clip){
 if(clip.width<250||clip.height<100||clip.x<0||clip.y<0)throw Error("Invalid capture rectangle");
 for(const selector of [".sidebar-account",".header-avatar",".dashboard-heading",".profile-heading"]){
  for(const node of await p.locator(selector).all()){
   const b=await node.boundingBox();if(b&&b.x<clip.x+clip.width&&b.x+b.width>clip.x&&b.y<clip.y+clip.height&&b.y+b.height>clip.y)throw Error("Capture would include personal identity area");
  }
 }
}
async function record({id,p,route,clip,duration,title,subtitle,action,synthetic=false,still=false}){
 if(scenes.some(scene=>scene.id===id)){await log({event:"reuse-verified-capture",id,route});return;}
 stage="record "+id;await p.bringToFront();
 if(synthetic)throw Error("Synthetic transport forbidden");
 await protect(p,clip);
 const dir=join(run,id);await mkdir(dir);
 await p.screenshot({path:join(dir,"start.png"),clip});
 if(still){
  const row={id,route,source:origin,clip,duration,title,subtitle,file:id+"/start.png",screenshot:id+"/start.png",captureKind:"screenshot",frameCount:1};
  scenes.push(row);await writeFile(join(run,"checkpoint.json"),JSON.stringify(scenes,null,2));await log({event:"captured-screenshot",id,route});return;
 }
 // Capture actual compositor frames. Full frames are cropped in memory BEFORE
 // any bytes hit disk. No cookies, traces, network payloads or DOM dumps are saved.
 const client=await p.context().newCDPSession(p),frames=[];
 let chain=Promise.resolve(),failure=null,accept=true;
 const started=Date.now();
 client.on("Page.screencastFrame",event=>{
  void client.send("Page.screencastFrameAck",{sessionId:event.sessionId}).catch(()=>{});
  if(!accept)return;
  const elapsed=(Date.now()-started)/1000,data=Buffer.from(event.data,"base64");
  chain=chain.then(async()=>{
   const meta=await sharp(data).metadata(),sx=meta.width/1920,sy=meta.height/1080;
   const left=Math.floor(clip.x*sx),top=Math.floor(clip.y*sy);
   const width=Math.min(meta.width-left,Math.floor(clip.width*sx)),height=Math.min(meta.height-top,Math.floor(clip.height*sy));
   const file=String(frames.length).padStart(5,"0")+".jpg";
   await sharp(data).extract({left,top,width,height}).jpeg({quality:93}).toFile(join(dir,file));
   frames.push({file,elapsed});
  }).catch(e=>{failure=e;});
 });
 await client.send("Page.startScreencast",{format:"jpeg",quality:95,maxWidth:1920,maxHeight:1080,everyNthFrame:1});
 try{
  await delay(1000);
  if(action)await action();
  await delay(Math.max(1000,duration*1000-(Date.now()-started)+600));
 }finally{
  accept=false;await client.send("Page.stopScreencast");await chain;await client.detach();
 }
 if(failure)throw failure;if(!frames.length)throw Error("No actual browser frames captured");
 const elapsed=(Date.now()-started)/1000;
 const concat=frames.map((f,i)=>"file '"+f.file+"'\nduration "+Math.max(.001,(frames[i+1]?.elapsed??elapsed)-f.elapsed).toFixed(6)).join("\n")+"\nfile '"+frames.at(-1).file+"'\n";
 await writeFile(join(dir,"frames.ffconcat"),concat);
 ff(["-f","concat","-safe","0","-i",join(dir,"frames.ffconcat"),"-vf","scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1,fps=60","-an","-c:v","libx264","-preset","fast","-crf","17","-pix_fmt","yuv420p","-movflags","+faststart",join(dir,"capture.mp4")]);
 await p.screenshot({path:join(dir,"end.png"),clip});
 const row={id,route,source:origin,clip,duration,title,subtitle,file:id+"/capture.mp4",screenshot:id+"/start.png",frameCount:frames.length,capturedSeconds:elapsed};
 scenes.push(row);await writeFile(join(run,"checkpoint.json"),JSON.stringify(scenes,null,2));await log({event:"captured",id,route,frames:frames.length});
}
try{
 await go(page,"/schedule",".schedule-day-deck");
 await log({event:"authorization-verified",route:"/schedule",method:"existing owner tab, actual protected UI; no cookie transfer"});
 await go(publicPage,"/","h1");await locale(publicPage,"ru","Привет.");await theme(publicPage,"light");
 await record({id:"01-welcome",still:true,p:publicPage,route:"/",clip:{x:0,y:0,width:1920,height:1080},duration:3.4,title:"NIS Hub",subtitle:"Твой путь начинается здесь."});

 await go(page,"/",".home-timetable");
 await expect(page.locator(".home-timetable .lesson-select").first()).toBeVisible();
 const home=await bounds(page,".home-timetable");
 await record({id:"02-day",p:page,route:"/",clip:home,duration:5.4,title:"Твой учебный день",subtitle:"Настоящее расписание · тестовый аккаунт",action:async()=>{
  const rows=page.locator(".home-timetable .lesson-select");
  if(await rows.count()<2)throw Error("Two actual lessons required");
  await rows.nth(1).click();await expect(rows.nth(1)).toHaveAttribute("aria-pressed","true");
 }});

 await go(page,"/schedule",".schedule-day-deck");
 const controls=await page.locator(".schedule-controls").boundingBox(),hero=await page.locator(".selected-lesson").boundingBox();
 if(!controls||!hero)throw Error("Schedule panels absent");
 const schedule={x:Math.ceil(controls.x),y:Math.ceil(controls.y),width:Math.floor(controls.width),height:Math.floor(Math.min(hero.y+hero.height,1068)-controls.y)};
 await record({id:"03-week",p:page,route:"/schedule",clip:schedule,duration:5.4,title:"Неделя перед глазами",subtitle:"Переключение учебных дней",action:async()=>{
  const tabs=page.getByRole("tab");await tabs.nth(3).click();await expect(tabs.nth(3)).toHaveAttribute("aria-selected","true");
  await expect(page.locator(".lesson-select").first()).toBeVisible();
 }});

 await go(page,"/library",".library-filters");await page.locator(".library-filters button").click();
 // This audited release has an empty published catalog. Never silently turn an
 // unreviewed catalog into footage (new content must be audited first).
 await expect(page.locator(".library-card")).toHaveCount(0);
 await record({id:"04-library",p:page,route:"/library",clip:await bounds(page,".page-content"),duration:5.4,title:"Фильтры библиотеки",subtitle:"Каталог сейчас пуст — без вымышленных книг",action:async()=>{
  await page.locator(".library-filters select").first().selectOption("9");
  await expect(page.locator(".library-filters select").first()).toHaveValue("9");
  await delay(700);await page.locator(".library-filters button").click();
 }});

 await go(publicPage,"/","h1");await locale(publicPage,"ru","Привет.");await theme(publicPage,"light");
 await record({id:"05-theme",p:publicPage,route:"/",clip:{x:0,y:0,width:1920,height:1080},duration:5.4,title:"Светлая. Тёмная.",subtitle:"Тема меняется настоящей кнопкой сайта",action:()=>theme(publicPage,"dark")});

 await record({id:"06-language",p:publicPage,route:"/",clip:{x:0,y:0,width:1920,height:1080},duration:5.4,title:"RU · KZ · EN",subtitle:"Выбери язык интерфейса",action:async()=>{
  await locale(publicPage,"kk","Сәлем.");await delay(1000);await locale(publicPage,"en","Hello.");
 }});
 await locale(publicPage,"ru","Привет.");
 await record({id:"07-outro",p:publicPage,route:"/",clip:{x:0,y:0,width:1920,height:1080},duration:4,title:"NIS Hub",subtitle:"Твой путь в NIS Hub начинается здесь."});
 const manifest={version:1,createdAt:new Date().toISOString(),sourceAudit:"promo/source-audit.md",resolution:[1920,1080],fps:60,transition:.4,expectedDuration:32,scenes};
 await writeFile(join(run,"manifest.json"),JSON.stringify(manifest,null,2));
 console.log("MANIFEST="+join(run,"manifest.json"));
}catch(e){
 await log({event:"failed",reason:e.name,stage,detail:"Expected route, element, privacy condition or capture failed; do not build partial footage."});
 process.exitCode=1;
}finally{
 if(!page.isClosed())await page.goto(returnUrl,{waitUntil:"domcontentloaded",timeout:45000}).catch(()=>{});
 await publicContext.close();await browser.close();
}
