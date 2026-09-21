// Owner-only interactive structural probe. No credentials, cookies, raw HTML,
// response bodies or screenshots are written. Output is structurally sanitized.
// Run locally, sign in directly on the official SMS site, open grades, then Enter.
import { chromium } from "@playwright/test";
import { createInterface } from "node:readline/promises";
import { build } from "esbuild";
const origin="https://sms.ura.nis.edu.kz";
const browser=await chromium.launch({headless:false,...(process.env.NIS_CHROMIUM_PATH?{executablePath:process.env.NIS_CHROMIUM_PATH}:{})});
const context=await browser.newContext({locale:"ru-RU"});
const page=await context.newPage();
const routes=new Map();
const responseShapes=new Map();
let selectedYear,selectedTerm;
const identifiers=new Map();
const identifier=value=>{if(!identifiers.has(value))identifiers.set(value,`[id-${identifiers.size+1}]`);return identifiers.get(value);};
const isIdentifier=value=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);
const cleanName=value=>/^[a-zA-Z_][a-zA-Z0-9_.[\]-]{0,80}$/.test(value)&&!/[0-9a-f]{8}-[0-9a-f-]{27,}|\d{6,}/i.test(value)?value:isIdentifier(value)?identifier(value):"[redacted]";
const shape=(value,depth=0,key="")=>{if(depth>10)return "[depth limit]";if(value===null)return null;if(Array.isArray(value))return value.slice(0,12).map(item=>shape(item,depth+1,key));if(typeof value==="object")return Object.fromEntries(Object.entries(value).slice(0,120).map(([childKey,v])=>[cleanName(childKey),shape(v,depth+1,childKey)]));if(typeof value==="boolean")return value;if(typeof value==="string"&&isIdentifier(value))return identifier(value);if(typeof value==="string"&&/url/i.test(key)){try{const url=new URL(value,origin);return url.origin===origin?url.pathname+"?"+[...url.searchParams].map(([k,v])=>`${cleanName(k)}=${isIdentifier(v)?identifier(v):"[redacted]"}`).join("&"):"[external]";}catch{return "string";}}return typeof value;};
page.on("response",async response=>{try { const url=new URL(response.url());if(url.origin===origin&&response.headers()["content-type"]?.includes("json"))responseShapes.set(url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}|\d{6,}/gi,"[id]"),shape(await response.json())); }catch{ /* Structural probe never logs response failures. */ }});
const safeRequestValue=(key,value)=>isIdentifier(value)?identifier(value):["page","start","limit","fullData","lang","theme","ch"].includes(key)&&/^[a-zA-Z0-9_.-]{0,30}$/.test(value)?value:"[redacted]";
page.on("request",request=>{
  const url=new URL(request.url());
  if(url.origin!==origin)return;
  const path=url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}|\d{6,}/gi,"[id]");
  const fields=[];
  const body=request.postData();
  const submitted=new URLSearchParams(body||"");
  if(url.pathname==="/Ref/GetPeriods")selectedYear=submitted.get("schoolYearId")||undefined;
  if(url.pathname==="/JceDiary/GetParallels")selectedTerm=submitted.get("periodId")||undefined;
  const fieldValues={};
  if(body&&request.headers()["content-type"]?.includes("application/x-www-form-urlencoded"))
    for(const [key,value] of new URLSearchParams(body)){fields.push(cleanName(key));fieldValues[cleanName(key)]=safeRequestValue(key,value);}
  routes.set(request.method()+" "+path,{method:request.method(),path,query:Object.fromEntries([...url.searchParams].map(([key,value])=>[cleanName(key),safeRequestValue(key,value)])),fieldNames:fields,fieldValues});
});
try {
  await page.goto(origin+"/Root/Account/Login?ReturnUrl=%2froot",{waitUntil:"domcontentloaded"});
  process.stdout.write("Official SMS opened. Sign in privately, then open Monitoring results -> JCE Diary (Мониторинг результатов -> Дневник ЖКО). No credentials in chat.\n");
  const input=createInterface({input:process.stdin,output:process.stdout});
  let command;
  while ((command=await input.question("inspect / verify / close: ")) !== "close") {
  if(command==="verify"){
    const compiled=await build({stdin:{contents:'export {SmsHttp} from "./src/lib/sms/http";export {fetchDiary,fetchDiarySubject} from "./src/lib/sms/grades";',resolveDir:process.cwd()},bundle:true,write:false,platform:"node",format:"esm",plugins:[{name:"probe-server-only",setup(b){b.onResolve({filter:/^server-only$/},()=>({path:"empty",namespace:"probe"}));b.onLoad({filter:/.*/,namespace:"probe"},()=>({contents:"export {};"}));}}]});
    const api=await import("data:text/javascript;base64,"+Buffer.from(compiled.outputFiles[0].contents).toString("base64"));
    let stage="session";
    const jar=(await context.cookies(origin)).map(c=>({name:c.name,value:c.value,path:c.path,...(c.expires>0?{expires:c.expires*1000}:{})}));
    const transport=async(url,init)=>{stage=new URL(url).pathname;return fetch(url,init);};
    const makeHttp=()=>new api.SmsHttp({origin,loginPath:"/Root/Account/Login?ReturnUrl=%2froot",timeoutMs:15000,maxBytes:2000000},jar,transport);
    try{
      const chooser=await api.fetchDiary(makeHttp());
      process.stdout.write(JSON.stringify({verification:"initial",ok:true,years:chooser.filters.years.length,terms:chooser.filters.terms.length})+"\n");
      if(selectedTerm){
        const selection={yearId:selectedYear,termId:selectedTerm};
        const diary=await api.fetchDiary(makeHttp(),undefined,selection);
        process.stdout.write(JSON.stringify({verification:"subjects",ok:true,count:diary.subjects.length})+"\n");
        if(diary.subjects[0]){const rows=await api.fetchDiarySubject(makeHttp(),selection,diary.subjects[0].sourceId);process.stdout.write(JSON.stringify({verification:"details",ok:true,count:rows.length})+"\n");}
      }
    }catch(error){process.stdout.write(JSON.stringify({verification:"failed",stage,code:["sms_changed","parse_failed","session_expired","timeout","sms_unavailable"].includes(error.code)?error.code:"failed"})+"\n");}
    continue;
  }
  const structures=[];
  for(const frame of page.frames()){
  const frameUrl=new URL(frame.url());
  if(frameUrl.origin!==origin)continue;
  try{const structure=await frame.evaluate(()=>{
    const safeWords=new Set("предмет пән subject балл баллы ұпай score максимум maximum max дата күні date процент пайыз percent тема тақырып title четверть тоқсан term учебный год оқу жылы academic year сор соч бжб тжб formative фо қб работа assessment оценки grades дневник diary итог всего total percent percentage name название наименование оценивание успеваемость обучение обучение математика mathematics физика physics chemistry химия biology биология география geography история history информатика русский язык литература қазақ тілі әдебиет английский english язык work тип type summative жиынтық қалыптастырушы бөлім тоқсандық суммативное формативное оценка ағымдағы текущая рейтинг rating".split(" "));
    const sanitize=text=>{
      const value=text.replace(/\s+/g," ").trim();if(!value)return "";
      if(/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(value))return "20.09.2026";
      if(/^\d{4}\s*[-/]\s*\d{4}$/.test(value))return "2026-2027";
      if(/^\d{1,3}([.,]\d{1,2})?\s*\/\s*\d{1,3}([.,]\d{1,2})?$/.test(value))return "7 / 10";
      if(/^\d{1,3}([.,]\d{1,2})?%?$/.test(value))return value.endsWith("%")?"70%":"7";
      return value.split(" ").map(word=>safeWords.has(word.toLocaleLowerCase().replace(/[:.,]/g,""))?word:"[redacted]").join(" ");
    };
    let count=0;
    const walk=(node,depth=0)=>{
      if(++count>15000||depth>60)return null;
      if(node.nodeType===Node.TEXT_NODE)return sanitize(node.textContent||"")||null;
      if(!(node instanceof Element)||["SCRIPT","STYLE","NOSCRIPT","SVG","IFRAME","INPUT"].includes(node.tagName))return null;
      const attrs={};
      for(const key of ["class","role","name"]){
        const value=node.getAttribute(key);
        if(value&&value.length<250&&!/\d{6,}|@/.test(value))attrs[key]=value;
      }
      const children=[...node.childNodes].map(child=>walk(child,depth+1)).filter(Boolean);
      if(!children.length&&!["SELECT","TABLE"].includes(node.tagName))return null;
      return {tag:node.tagName.toLowerCase(),attrs,children};
    };
    const compact=node=>{if(!node)return null;if(typeof node==="string")return node;if(node.children.length===1)return compact(node.children[0]);return {...node,children:node.children.map(compact)};};
    return {authenticated:window.App?.Server?.User?.IsAuthenticated===true,dom:compact(walk(document.body))};
  });structures.push({path:frameUrl.pathname,structure});}catch{/* Detached or cross-process frame; no output. */}
  }
  process.stdout.write(JSON.stringify({notice:"SANITIZED STRUCTURE ONLY; credentials, cookies, identifiers and grade values are never emitted",responseShapes:Object.fromEntries(responseShapes),routes:[...routes.values()].filter(r=>!(/\.(?:png|jpg|gif|css|woff2)$/.test(r.path)||/sencha|appjs/.test(r.path))),structures})+"\n");
  }
  input.close();
} finally {await context.close();await browser.close();}
