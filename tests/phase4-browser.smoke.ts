import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { resolve,join } from "node:path";
import { build } from "esbuild";
import { chromium,webkit,expect } from "@playwright/test";
import { books,classes,subjects } from "./browser/fixtures";
import { parseTimetable } from "../src/lib/timetable-import";
import { themeBootstrap } from "../src/lib/theme";
import { filterBooks, initialLibraryFilters } from "../src/lib/library";
import { dictionaries, subjectName } from "../src/lib/i18n";
import { phase4Copy } from "../src/lib/phase4-copy";
const artifactDir=process.env.NIS_BROWSER_ARTIFACTS || "/private/tmp/nis-phase4-browser-results";
const id="00000000-0000-4000-8000-000000000030";
test("Phase 4 Chromium/WebKit production components with isolated transport", {timeout:240000},async t=>{
  const pdfPath=process.env.NIS_READER_TEST_PDF;
  assert.ok(pdfPath,"Set NIS_READER_TEST_PDF to the existing reader test PDF.");
  const pdf=readFileSync(pdfPath);
  const bundle=await build({entryPoints:[resolve("tests/browser/phase4-harness.tsx")],bundle:true,write:false,format:"esm",platform:"browser",jsx:"automatic",logLevel:"silent",
    define:{"process.env":JSON.stringify({NODE_ENV:"production"})},plugins:[{name:"test-only-boundaries",setup(api){
      api.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"fixture"}));
      api.onResolve({filter:/^@\/lib\/supabase\/client$/},()=>({path:"storage",namespace:"fixture"}));
      api.onResolve({filter:/^@\/app\/actions\/reading$/},()=>({path:"reading",namespace:"fixture"}));
      api.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:args.path==="navigation"
        ? 'export function useRouter(){return {replace(url){window.history.replaceState(null,"",url);}};}'
        : args.path==="storage" ? 'export function createClient(){return {storage:{from(){return {async upload(path,body,options){const r=await fetch("/fixture/upload",{method:"PUT",body,headers:{"X-Path":path,"X-Upsert":String(options.upsert)}});return {error:r.ok?null:{message:"Fixture upload error"}};}}}}};}'
        : 'export async function saveReading(bookId,page,mode){const r=await fetch("/fixture/reading",{method:"POST",body:JSON.stringify({bookId,page,mode})});return r.json();}',loader:"js"}));
    }}]});
  const css=readdirSync(".next/static/css").filter(n=>n.endsWith(".css")).map(n=>readFileSync(join(".next/static/css",n),"utf8")).join("\n");
  const requests:string[]=[];let book:Record<string,unknown>|null=null,uploaded=false;
  let reading={page:1,bookmarks:[] as number[]};
  const server=createServer(async(req,res)=>{
    const path=new URL(req.url!,"http://fixture.test").pathname;requests.push(req.method+" "+path);
    res.setHeader("Cache-Control","no-store");
    if(path==="/bundle.js"){res.setHeader("Content-Type","application/javascript");res.end(bundle.outputFiles[0].contents);return;}
    if(path==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css);return;}
    if(path==="/pdfjs-dist/legacy/build/pdf.worker.min.mjs"){res.setHeader("Content-Type","application/javascript");res.end(readFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"));return;}
    if(/^\/pdfjs\/(cmaps|standard_fonts|wasm|iccs)\/[a-zA-Z0-9_.-]+$/.test(path)){res.end(readFileSync("public"+path));return;}
    if(path==="/fixture.pdf"){res.setHeader("Content-Type","application/pdf");res.end(pdf);return;}
    if(path==="/api/books/"+id+"/access"){res.setHeader("Content-Type","application/json");res.end(JSON.stringify({url:"/fixture.pdf",expiresIn:60}));return;}
    if(path.startsWith("/fixture/")){
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
      res.setHeader("Content-Type","application/json");
      if(path==="/fixture/save"){
        const data=JSON.parse(body.toString());
        if(data.stage==="prepare"){book={...data,publication_status:"draft"};res.end(JSON.stringify({success:"Prepared"}));}
        else if(!uploaded){res.end(JSON.stringify({error:"No uploaded PDF"}));}
        else {book=data;res.end(JSON.stringify({success:"Material saved."}));}
      }else if(path==="/fixture/upload"){
        assert.ok(book,"Metadata must precede file upload");assert.equal(book.publication_status,"draft");
        assert.equal(req.headers["x-path"],"books/"+id+".pdf");
        if(uploaded && req.headers["x-upsert"]!=="true"){res.statusCode=409;res.end("{}");return;}
        assert.ok(body.subarray(0,1024).includes(Buffer.from("%PDF-")));uploaded=true;res.end("{}");
      }else if(path==="/fixture/reading"){
        const data=JSON.parse(body.toString());
        if(data.mode==="progress")reading.page=data.page;
        if(data.mode==="bookmark"&&!reading.bookmarks.includes(data.page))reading.bookmarks.push(data.page);
        if(data.mode==="remove")reading.bookmarks=reading.bookmarks.filter(p=>p!==data.page);
        res.end(JSON.stringify({success:"Saved"}));
      }else{
        const preview=parseTimetable(body.toString(),classes,subjects);
        res.end(JSON.stringify(preview.issues.length?{error:"Invalid fixture import"}:{success:"Timetable saved."}));
      }return;
    }
    res.setHeader("Content-Type","text/html; charset=utf-8");
    res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>'+themeBootstrap+
      ';window.fixtureReading='+JSON.stringify(reading)+'</script><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  });
  server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert.ok(address&&typeof address!=="string");const origin="http://127.0.0.1:"+address.port;
  mkdirSync(artifactDir,{recursive:true});
  try{for(const[name,engine]of [["chromium",chromium],["webkit",webkit]]as const){
    const browser=await engine.launch({headless:true});
    try{
      await t.test(name+": weekly day/class switching sends no requests; mobile locales/themes; validated CSV and TSV",async()=>{
        const page=await browser.newPage({viewport:{width:390,height:844}});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
        await page.goto(origin+"/weekly");await page.waitForLoadState("networkidle");
        const mark=requests.length;
        await expect(page.getByRole("tabpanel").locator("li")).toHaveCount(1);
        await expect(page.getByRole("tabpanel")).toContainText("1–2");
        await page.getByRole("tab",{name:"Tuesday",exact:true}).click();
        await expect(page.getByRole("tabpanel")).toContainText("3–4");
        await page.keyboard.press("ArrowRight");await expect(page.getByRole("tab",{name:"Wednesday",exact:true})).toBeFocused();
        await expect(page.getByRole("tabpanel").locator("li")).toHaveCount(0);
        await page.keyboard.press("Home");await expect(page.getByRole("tabpanel")).toContainText("1–2");
        await page.getByRole("combobox",{name:"Class",exact:true}).selectOption(classes[1].id);await expect(page.getByRole("tabpanel").locator("li")).toHaveCount(0);
        assert.deepEqual(requests.slice(mark),[]);
        for(const locale of ["ru","kk","en"]as const){
          const old=dictionaries[await page.locator("html").getAttribute("lang") as "ru"|"kk"|"en"];
          await page.getByRole("combobox",{name:old.locale,exact:true}).selectOption(locale);
          await expect(page.getByRole("tab",{name:phase4Copy(locale).weekdays[0],exact:true})).toBeVisible();
        }
        const p=phase4Copy("en"),d=dictionaries.en;
        for(const theme of ["light","dark"]){await page.getByRole("radio",{name:d[theme as "light"|"dark"],exact:true}).check();}
        const raw="class,weekday,lesson_start,lesson_end,start_time,end_time,subject,teacher,room\n"+classes[0].name+",Fri,7,8,13:50,15:20,"+subjects[0].name+",Teacher,228";
        await page.getByRole("textbox",{name:p.paste}).fill(raw.replace(classes[0].name,"TYPO"));await page.getByRole("button",{name:p.preview}).click();
        await expect(page.getByRole("alert")).toContainText(p.class);await expect(page.getByRole("button",{name:p.import,exact:true})).toHaveCount(0);
        for(const value of [raw,raw.replace(/,/g,"\t")]){
          await page.getByRole("textbox",{name:p.paste}).fill(value);await page.getByRole("button",{name:p.preview}).click();
          await expect(page.getByRole("table")).toContainText("7–8");await expect(page.getByRole("button",{name:p.import,exact:true})).toBeDisabled();
          await page.getByRole("checkbox",{name:p.confirm}).check();await page.getByRole("button",{name:p.import,exact:true}).click();
          await expect(page.locator("output")).toContainText("Timetable saved.");
        }
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
        await page.screenshot({path:join(artifactDir,name+"-weekly-mobile.png"),fullPage:true});assert.deepEqual(errors,[]);await page.close();
      });
      await t.test(name+": Home/Schedule subject clicks preserve canonical filters; no teacher on mobile; empty books are normal",async()=>{
        const page=await browser.newPage({viewport:{width:390,height:844}});
        const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
        for(const path of ["/home-timetable","/weekly"]){
          for(const locale of ["ru","kk","en"] as const){
            await page.goto(origin+path);await page.getByRole("combobox",{name:dictionaries.en.locale,exact:true}).selectOption(locale);
            const scope=path==="/weekly"?page.getByRole("tabpanel"):page.getByRole("region",{name:"Home timetable"});
            await expect(scope).not.toContainText("Teacher");
            await expect(scope).not.toContainText(dictionaries[locale].teacher+":");
            await expect(scope).toContainText("08:30–10:10");await expect(scope).toContainText("305");
            const link=scope.getByRole("link",{name:subjectName(subjects[0],locale),exact:true});
            const href=await link.getAttribute("href");assert.ok(href);
            const url=new URL(href,origin);
            assert.equal(url.pathname,"/library");
            const expected={q:"",grade:String(classes[0].grade),subject:subjects[0].id};
            assert.deepEqual(initialLibraryFilters(Object.fromEntries(url.searchParams),String(classes[1].grade)),expected);
            const bounds=await link.boundingBox();assert.ok(bounds&&bounds.height>=44);
            assert.ok((await link.evaluate(element=>getComputedStyle(element).textDecorationLine)).includes("underline"));
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
            if(locale==="kk") await page.getByRole("radio",{name:dictionaries.kk.dark,exact:true}).check();
            await page.screenshot({path:join(artifactDir,name+"-"+(path==="/weekly"?"schedule":"home")+"-"+locale+"-mobile.png"),fullPage:true});
            await link.focus();await page.keyboard.press("Enter");await page.waitForURL("**/library?**");
            await expect(page.getByRole("combobox",{name:"Subject",exact:true})).toHaveValue(expected.subject);
            await expect(page.getByRole("combobox",{name:"Grade",exact:true})).toHaveValue(expected.grade);
            await expect(page.getByRole("searchbox")).toHaveValue("");
            await expect(page.locator("section li")).toHaveCount(filterBooks(books,expected).length);
            await expect(page.getByRole("alert")).toHaveCount(0);
          }
        }
        // Changing the Schedule class must override the profile default in Library.
        await page.goto(origin+"/weekly");await page.getByRole("combobox",{name:"Class",exact:true}).selectOption(classes[1].id);
        await page.getByRole("tab",{name:"Thursday",exact:true}).click();
        await page.getByRole("tabpanel").getByRole("link",{name:"Mathematics",exact:true}).click();await page.waitForURL("**/library?**");
        await expect(page.getByRole("combobox",{name:"Grade",exact:true})).toHaveValue(String(classes[1].grade));
        await expect(page.locator("section li")).toHaveCount(filterBooks(books,{q:"",subject:subjects[0].id,grade:String(classes[1].grade)}).length);
        // Biology deliberately has no published books in the fixture catalog.
        await page.goto(origin+"/weekly");await page.getByRole("tab",{name:"Friday",exact:true}).click();
        await page.getByRole("tabpanel").getByRole("link",{name:"Biology",exact:true}).click();await page.waitForURL("**/library?**");
        await expect(page.getByRole("combobox",{name:"Subject",exact:true})).toHaveValue(subjects[2].id);
        await expect(page.getByRole("heading",{name:dictionaries.en.noMaterials,exact:true})).toBeVisible();
        await expect(page.getByRole("alert")).toHaveCount(0);
        assert.deepEqual(errors,[]);await page.close();
      });
      await t.test(name+": small PDF create/publish, explicit replacement and pre-network oversized rejection",async()=>{
        book=null;uploaded=false;const page=await browser.newPage();await page.goto(origin+"/books");await page.waitForLoadState("networkidle");
        await page.getByRole("textbox",{name:"Title",exact:true}).fill("Reader test");
        await page.getByRole("combobox",{name:"Subject",exact:true}).selectOption(subjects[0].id);
        await page.getByRole("combobox",{name:"Grade",exact:true}).selectOption("9");
        await page.getByRole("combobox",{name:"Book publication (all editions)",exact:true}).selectOption("published");
        await page.getByRole("combobox",{name:"Edition publication",exact:true}).selectOption("published");
        await page.getByLabel("PDF file",{exact:true}).setInputFiles({name:"test.pdf",mimeType:"application/pdf",buffer:pdf});
        const mark=requests.length;await page.getByRole("button",{name:"Save material",exact:true}).click();
        await expect(page.getByText("Material saved.",{exact:true})).toBeVisible();
        assert.deepEqual(requests.slice(mark),["POST /fixture/save","PUT /fixture/upload","POST /fixture/save"]);
        assert.equal((book as Record<string,unknown>|null)?.publication_status,"published");
        const after=requests.length;await page.getByRole("button",{name:"Save material",exact:true}).click();
        await expect(page.getByRole("alert")).toContainText(phase4Copy("en").bookInvalid);assert.equal(requests.length,after);
        await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Save material",exact:true}).click();
        await expect(page.getByText("Material saved.",{exact:true})).toBeVisible();
        const big=requests.length;
        await page.getByLabel("PDF file",{exact:true}).evaluate(element=>{
          const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(52428801)],"big.pdf",{type:"application/pdf"}));
          (element as HTMLInputElement).files=transfer.files;element.dispatchEvent(new Event("change",{bubbles:true}));
        });
        await expect(page.getByRole("alert")).toContainText("PDF exceeds 50 MB");await expect(page.getByRole("button",{name:"Save material",exact:true})).toBeDisabled();assert.equal(requests.length,big);
        await page.close();
      });
      await t.test(name+": real PDF.js canvas pages/zoom/text/bookmarks/progress use one session download",async()=>{
        reading={page:1,bookmarks:[]};const page=await browser.newPage({viewport:{width:950,height:850}});
        const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));const mark=requests.length;
        await page.goto(origin+"/reader");
        const next=page.getByRole("button",{name:dictionaries.en.next,exact:true});
        await expect(next).toBeEnabled({timeout:30000});await expect(page.locator("canvas")).toBeVisible();
        // Actual dark ink exists, not merely an empty canvas element.
        assert.ok(await page.locator("canvas").evaluate((element)=>{const c=element as HTMLCanvasElement;const data=c.getContext("2d")!.getImageData(0,0,c.width,c.height).data;let ink=0;for(let i=0;i<data.length;i+=4)if(data[i+3]&&data[i]<180)ink++;return ink>100;}));
        await next.click();await expect(next).toBeEnabled();await next.click();await expect(next).toBeEnabled();
        await expect(page.getByRole("spinbutton")).toHaveAttribute("placeholder","3");
        await page.getByRole("button",{name:"Zoom in",exact:true}).click();
        await page.getByRole("button",{name:"Zoom in",exact:true}).click();
        await expect(next).toBeEnabled();
        await page.locator("summary").click();await expect(page.locator("details p")).not.toBeEmpty();
        await page.getByRole("button",{name:dictionaries.en.addBookmark,exact:true}).click();
        await expect(page.getByRole("button",{name:dictionaries.en.removeBookmark,exact:true})).toBeEnabled();
        await expect.poll(()=>reading.page).toBe(3);assert.deepEqual(reading.bookmarks,[3]);
        const d=dictionaries.en;await page.getByRole("combobox",{name:d.locale,exact:true}).selectOption("kk");
        await page.getByRole("radio",{name:dictionaries.kk.dark,exact:true}).check();
        await expect(page.locator("canvas")).toBeVisible();
        assert.equal(requests.slice(mark).filter(r=>r==="GET /fixture.pdf").length,1);
        assert.equal(requests.slice(mark).filter(r=>r==="GET /api/books/"+id+"/access").length,1);
        await page.screenshot({path:join(artifactDir,name+"-reader.png")});
        await page.reload();await expect(page.getByRole("button",{name:d.next,exact:true})).toBeEnabled({timeout:30000});
        await expect(page.getByRole("spinbutton")).toHaveAttribute("placeholder","3");await expect(page.getByRole("button",{name:d.removeBookmark,exact:true})).toBeEnabled();
        assert.equal(requests.slice(mark).filter(r=>r==="GET /fixture.pdf").length,2);assert.deepEqual(errors,[]);await page.close();
      });
    }finally{await browser.close();}
  }}finally{await new Promise<void>((done)=>server.close(()=>done()));}
});
