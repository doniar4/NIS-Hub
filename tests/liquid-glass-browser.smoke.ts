import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync,mkdirSync} from "node:fs";
import {join,basename} from "node:path";
import {createServer} from "node:http";
import {once} from "node:events";
import {build} from "esbuild";
import {chromium,webkit,expect} from "@playwright/test";
import {themeBootstrap} from "../src/lib/theme";
import {parseGrades} from "../src/lib/sms/parser";
import {subjects,classes} from "./browser/fixtures";

const id="00000000-0000-4000-8000-000000000030";
test("Liquid Glass: real components, isolated transport, Chromium/WebKit responsive and functional QA",{timeout:480000},async t=>{
  assert.ok(process.env.NIS_READER_TEST_PDF,"Provide the existing local test PDF");
  const pdf=readFileSync(process.env.NIS_READER_TEST_PDF!);
  const bundle=await build({entryPoints:["tests/browser/liquid-glass-harness.tsx"],bundle:true,write:false,format:"esm",platform:"browser",jsx:"automatic",define:{"process.env":JSON.stringify({NODE_ENV:"production"})},plugins:[{name:"isolated-boundaries",setup(api){
    api.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"fixture"}));
    api.onResolve({filter:/^@\/lib\/(supabase\/client|community-client)$/},a=>({path:a.path,namespace:"fixture"}));
    api.onResolve({filter:/^@\/app\/actions\//},a=>({path:a.path,namespace:"fixture"}));
    api.onLoad({filter:/.*/,namespace:"fixture"},a=>{
      const call='const rpc=async(name,args)=>(await fetch("/rpc",{method:"POST",body:JSON.stringify({name,args})})).json();';
      const content=a.path==="navigation"?'export const usePathname=()=>location.pathname;export const useRouter=()=>({refresh(){},replace(url){history.replaceState(null,"",url);}});':
        a.path.endsWith("community-client")?'export const loadNotifications=async()=>({data:[],unread:0});export const dismissNotification=async()=>({success:true});export const blockPerson=async()=>({success:true});export const reportContent=async()=>({success:true});':
        a.path.endsWith("supabase/client")?'export const createClient=()=>({storage:{from:()=>({upload:async()=>({error:null})})}});':
        a.path.endsWith("reading")?call+'export const saveReading=(...args)=>rpc("reading",args);':
        a.path.endsWith("homework")?call+'export const loadHomework=(...args)=>rpc("homework",args);export const saveHomework=async()=>({success:true});export const deleteHomework=async()=>({success:true});':
        a.path.endsWith("sms")?call+'export const refreshSms=()=>rpc("sms",[]);export const connectSms=()=>rpc("sms",[]);export const disconnectSms=async()=>({connected:false});export const loadSmsSubject=async()=>({assessments:[]});':
        a.path.endsWith("ai-study")?call+'export const generateStudy=(args)=>rpc("study",args);':
        a.path.endsWith("study-answers")?'export const reviewStudyAnswers=async()=>({error:"failed"});':
        a.path.endsWith("edupage")?'export const syncEduPage=async()=>({error:"unavailable"});':
        'export const safetyAction=async()=>({success:true});';
      return {contents:content,loader:"js"};
    });
  }}]});
  const css=readdirSync(".next/static/css").filter(n=>n.endsWith(".css")).map(n=>readFileSync(join(".next/static/css",n),"utf8")).join("\n");
  const snapshot=parseGrades(readFileSync("tests/fixtures/sms/grades-semantic.html","utf8"),new Date("2026-09-18T09:00:00Z"));
  const reading={page:1,bookmarks:[] as number[]},calls:{name:string;args:unknown}[]=[];
  const server=createServer(async(req,res)=>{
    const path=new URL(req.url!,"http://localhost").pathname;res.setHeader("Cache-Control","no-store");
    if(path==="/bundle.js"){res.setHeader("Content-Type","application/javascript");res.end(bundle.outputFiles[0].contents);return;}
    if(path==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css);return;}
    if(path.endsWith(".woff2")){try{res.end(readFileSync(join(".next/static/media",basename(path))));}catch{res.statusCode=404;res.end();}return;}
    if(path==="/favicon.ico"){res.statusCode=204;res.end();return;}
    if(path==="/pdfjs-dist/legacy/build/pdf.worker.min.mjs"){res.setHeader("Content-Type","application/javascript");res.end(readFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"));return;}
    if(/^\/pdfjs\/(cmaps|standard_fonts|wasm|iccs)\/[a-zA-Z0-9_.-]+$/.test(path)){res.end(readFileSync("public"+path));return;}
    if(path==="/fixture.pdf"){res.setHeader("Content-Type","application/pdf");res.end(pdf);return;}
    if(path==="/api/books/"+id+"/access"){res.setHeader("Content-Type","application/json");res.end(JSON.stringify({url:"/fixture.pdf",expiresIn:60}));return;}
    if(path==="/rpc"){
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);
      const body=JSON.parse(Buffer.concat(chunks).toString());calls.push(body);
      res.setHeader("Content-Type","application/json");
      if(body.name==="sms"){res.end(JSON.stringify({connected:true,snapshot}));return;}
      if(body.name==="homework"){await new Promise(r=>setTimeout(r,120));res.end(JSON.stringify({data:[{id:"hw",subject_id:subjects[0].id,body:"Homework for "+body.args[0]}]}));return;}
      if(body.name==="study"){res.end(JSON.stringify({response:{insufficient:true,sections:[]},source:{start:body.args.start,end:body.args.end}}));return;}
      if(body.name==="reading"){const [,page,mode]=body.args;if(mode==="progress")reading.page=page;if(mode==="bookmark")reading.bookmarks.push(page);if(mode==="remove")reading.bookmarks=reading.bookmarks.filter(n=>n!==page);}
      res.end(JSON.stringify({success:"Saved"}));return;
    }
    res.setHeader("Content-Type","text/html;charset=utf-8");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>'+themeBootstrap+';window.fixtureReading='+JSON.stringify(reading)+'</script><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  });
  server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert.ok(address&&typeof address!=="string");
  const origin="http://127.0.0.1:"+address.port,dir=process.env.NIS_BROWSER_ARTIFACTS||"/private/tmp/nis-liquid-glass-results";
  mkdirSync(dir,{recursive:true});
  try {
    for(const [name,engine]of [["chromium",chromium],["webkit",webkit]]as const){
      if(process.env.NIS_BROWSER_ENGINE&&process.env.NIS_BROWSER_ENGINE!==name)continue;
      const browser=await engine.launch({headless:true});
      try {
        const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];
        page.on("pageerror",error=>errors.push(new URL(page.url()).pathname+": "+error.message));
        await page.goto(origin+"/");
        await expect(page.locator(".lesson-select[aria-pressed=true]")).toContainText("Mathematics");
        await page.locator(".lesson-select").filter({hasText:"248"}).click();
        await expect(page.locator(".selected-lesson h2")).toHaveText("Physics");
        await expect(page.locator(".selected-lesson .lesson-facts")).toContainText("248");
        const aiUrl=new URL(await page.locator(".selected-lesson-actions a").last().getAttribute("href")||"",origin);
        assert.equal(aiUrl.searchParams.get("subject"),subjects[1].id);assert.equal(aiUrl.searchParams.get("grade"),String(classes[0].grade));assert.equal(aiUrl.searchParams.get("study"),"1");
        await page.locator(".home-timetable .timetable-heading button").last().click();
        await expect(page.locator(".home-timetable time").first()).toHaveAttribute("datetime","2026-09-22");
        await expect(page.locator(".calendar-notice")).toContainText("School holiday");
        await expect(page.locator(".calendar-notice")).toContainText("Weekend");
        await expect(page.locator(".homework-preview")).toContainText("Homework for 2026-09-22");
        assert.ok(!await page.locator("body").innerText().then(s=>s.includes("MUST NOT DISPLAY")));
        await page.locator(".timetable-today").click();
        await expect(page.locator(".homework-preview")).toContainText("Homework for 2026-09-18");
        assert.ok((await page.locator("body").evaluate(el=>getComputedStyle(el).fontFamily)).includes("Noto Sans"));
        assert.equal(await page.locator(".app-sidebar").evaluate(el=>getComputedStyle(el).left),"16px");
        await page.locator(".lesson-select").first().focus();await page.keyboard.press("Enter");
        await expect(page.locator(".selected-lesson-actions a").last()).toHaveAttribute("href","/books/"+id+"/read?variant="+id+"#ai-study");

        await page.goto(origin+"/library?subject="+subjects[0].id+"&grade=7&study=1");
        await expect(page.locator(".library-card").first()).toHaveAttribute("href",/#ai-study$/);
        await page.waitForLoadState("networkidle");
        const requests:string[]=[];const track=(r:{url():string})=>requests.push(r.url());page.on("request",track);
        await page.locator(".library-filters input").fill("NO MATCH");
        await expect(page.getByRole("heading",{name:"No materials found"})).toBeVisible();
        await page.locator(".library-filters select").first().selectOption("8");
        await page.locator(".library-filters select").last().selectOption(subjects[1].id);
        await page.getByRole("button",{name:"Reset filters"}).click();await expect(page.locator(".library-card")).toHaveCount(125);
        assert.deepEqual(requests,[]);page.off("request",track);

        await page.goto(origin+"/schedule");
        await page.getByRole("tab").first().click();await page.keyboard.press("ArrowRight");
        await expect(page.getByRole("tab").nth(1)).toHaveAttribute("aria-selected","true");
        await expect(page.locator(".homework-preview")).toContainText("Homework for 2026-09-15");
        await page.locator(".lesson-select").filter({hasText:"Group B"}).click();await expect(page.locator(".selected-lesson")).toContainText("Group B");

        for(const locale of ["ru","kk","en"]as const)for(const width of [1440,1024,768,390,320])for(const theme of ["light","dark"]){
          await page.setViewportSize({width,height:1000});await page.goto(origin+"/?locale="+locale);
          await page.evaluate(value=>{document.documentElement.dataset.theme=value;},theme);
          await expect(page.locator(".homework-preview")).toContainText("Homework for");
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),name+" home "+locale+" "+width+" "+theme);
          if(locale==="ru"&&(width===1440||width===390))await page.screenshot({path:join(dir,name+"-home-"+width+"-"+theme+".png"),fullPage:true,animations:"disabled"});
        }
        for(const route of ["/library","/schedule","/profile","/diary","/support","/admin"]){
          for(const width of [1440,390,320])for(const locale of ["ru","kk","en"])for(const theme of ["light","dark"]){
            await page.setViewportSize({width,height:1000});await page.goto(origin+route+"?locale="+locale);await page.evaluate(value=>{document.documentElement.dataset.theme=value;},theme);await page.waitForTimeout(100);
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),name+" "+route+" "+width);
            if(width!==320&&locale==="ru")await page.screenshot({path:join(dir,name+"-"+route.slice(1)+"-"+width+"-"+theme+".png"),fullPage:true,animations:"disabled"});
          }
        }
        await page.setViewportSize({width:1440,height:1000});await page.goto(origin+"/");
        await page.locator(".sidebar-collapse").click();await expect(page.locator(".sidebar-collapse")).toHaveAttribute("aria-expanded","false");
        await page.reload();await expect(page.locator(".sidebar-collapse")).toHaveAttribute("aria-expanded","false");
        await page.locator(".sidebar-collapse").click();
        await page.evaluate(()=>{document.body.style.zoom="2";});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),name+" 200% zoom");
        await page.evaluate(()=>{document.body.style.zoom="1";});
        await page.setViewportSize({width:390,height:844});await page.locator(".mobile-menu").click();await expect(page.locator(".mobile-drawer")).toHaveAttribute("open","");
        await page.keyboard.press("Escape");await expect(page.locator(".mobile-menu")).toBeFocused();
        await page.emulateMedia({reducedMotion:"reduce"});await page.goto(origin+"/");
        assert.equal(await page.locator(".selected-lesson-content").evaluate(el=>getComputedStyle(el).animationName),"none");
        await page.emulateMedia({reducedMotion:"no-preference"});

        await page.setViewportSize({width:1440,height:1000});reading.page=1;reading.bookmarks=[];
        await page.goto(origin+"/books/"+id+"/read");
        await expect(page.locator('[data-page="1"] canvas')).toBeVisible({timeout:30000});
        const ink=await page.locator('[data-page="1"] canvas').evaluate(el=>{const c=el as HTMLCanvasElement,data=c.getContext("2d")!.getImageData(0,0,c.width,c.height).data;let count=0;for(let i=0;i<data.length;i+=4)if(data[i]<240||data[i+1]<240||data[i+2]<240)count++;return count;});
        assert.ok(ink>100,"Real PDF pixels rendered");
        await page.getByRole("button",{name:"Page thumbnails",exact:true}).click();
        await expect(page.locator(".pdf-thumbnail canvas").first()).toBeVisible();
        await page.locator(".pdf-thumbnail").nth(2).click();
        await expect(page.locator(".reader-controls")).toContainText("3 /");
        await page.getByRole("button",{name:"Add bookmark",exact:true}).click();await expect(page.getByRole("button",{name:"Remove bookmark",exact:true})).toBeVisible();
        await expect.poll(()=>reading.page).toBe(3);
        await page.getByRole("button",{name:"Previous",exact:true}).click();await expect(page.locator(".reader-controls")).toContainText("2 /");
        await page.locator(".pdf-scroll-viewport").focus();await page.keyboard.press("PageUp");await expect(page.locator(".reader-controls")).toContainText("1 /");
        await page.getByRole("button",{name:"Zoom in",exact:true}).click();await expect(page.locator(".reader-controls")).toContainText("125%");
        await page.getByRole("button",{name:"Fit page",exact:true}).click();await expect(page.getByRole("button",{name:"Fit page",exact:true})).toHaveAttribute("aria-pressed","true");
        await page.getByRole("button",{name:"Fit width",exact:true}).click();
        await page.locator(".pdf-reader > details summary").click();await expect(page.locator(".pdf-reader > details p")).not.toBeEmpty();
        const inputs=page.locator(".ai-study-panel input");
        await inputs.first().fill("1");await inputs.last().fill("2");
        await page.locator(".ai-study-panel button[type=submit],.ai-study-panel .ai-generate-button").first().click();
        await expect(page.locator(".ai-study-panel")).toContainText("1–2");
        await page.locator(".inspector-heading button").click();await page.locator(".reader-workspace-heading button").click();
        await expect(inputs.last()).toHaveValue("2");
        await page.screenshot({path:join(dir,name+"-reader-desktop.png"),fullPage:true,animations:"disabled"});
        await page.setViewportSize({width:390,height:844});await expect(page.locator(".reader-inspector")).toHaveJSProperty("open",true);
        await page.keyboard.press("Escape");await expect(page.locator(".reader-workspace-heading button")).toBeFocused();
        await page.locator(".reader-workspace-heading button").click();await expect(inputs.last()).toHaveValue("2");
        await page.screenshot({path:join(dir,name+"-reader-sheet.png"),fullPage:true,animations:"disabled"});
        await page.keyboard.press("Escape");assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),name+" reader mobile");
        await page.getByRole("button",{name:"Page 3",exact:true}).last().click();await expect.poll(()=>reading.page).toBe(3);
        await page.reload();await expect(page.locator(".reader-controls")).toContainText("3 /",{timeout:30000});await expect(page.getByRole("button",{name:"Remove bookmark",exact:true})).toBeVisible();
        assert.deepEqual(errors,[]);
        t.diagnostic(name+": home 30 locale/theme/viewport combinations; 6 other screens × 18 locale/theme/viewport combinations; 200% CSS zoom; keyboard/drawer/reduced motion; actual PDF pixels, thumbnails, navigation, zoom, text, bookmark/progress, persistent AI range. Auth/SMS/Gemini/Storage transport is synthetic.");
      } finally {await browser.close();}
    }
  } finally {server.close();await once(server,"close");}
});
