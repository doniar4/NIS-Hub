// Owner-only interactive structural probe. No credentials, cookies, raw HTML,
// response bodies or screenshots are written. Output is structurally sanitized.
// Run locally, sign in directly on the official SMS site, open grades, then Enter.
import { chromium } from "@playwright/test";
import { createInterface } from "node:readline/promises";
const origin="https://sms.ura.nis.edu.kz";
const browser=await chromium.launch({headless:false,...(process.env.NIS_CHROMIUM_PATH?{executablePath:process.env.NIS_CHROMIUM_PATH}:{})});
const context=await browser.newContext({locale:"ru-RU"});
const page=await context.newPage();
const routes=new Map();
const responseShapes=new Map();
const shape=(value,depth=0)=>{if(depth>10)return "[depth limit]";if(value===null)return null;if(Array.isArray(value))return value.slice(0,2).map(item=>shape(item,depth+1));if(typeof value==="object")return Object.fromEntries(Object.entries(value).slice(0,100).map(([key,v])=>[cleanName(key),shape(v,depth+1)]));return typeof value;};
page.on("response",async response=>{try { const url=new URL(response.url());if(url.origin===origin&&response.headers()["content-type"]?.includes("json"))responseShapes.set(url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}|\\d{6,}/gi,"[id]"),shape(await response.json())); }catch{ /* Structural probe never logs response failures. */ }});
const cleanName=value=>/^[a-zA-Z_][a-zA-Z0-9_.[\]-]{0,80}$/.test(value)&&!/[0-9a-f]{8}-[0-9a-f-]{27,}|\d{6,}/i.test(value)?value:"[redacted]";
page.on("request",request=>{
  const url=new URL(request.url());
  if(url.origin!==origin)return;
  const path=url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}|\d{6,}/gi,"[id]");
  const fields=[];
  const body=request.postData();
  if(body&&request.headers()["content-type"]?.includes("application/x-www-form-urlencoded"))
    for(const key of new URLSearchParams(body).keys())fields.push(cleanName(key));
  routes.set(request.method()+" "+path,{method:request.method(),path,queryKeys:[...url.searchParams.keys()].map(cleanName),fieldNames:fields});
});
try {
  await page.goto(origin+"/Root/Account/Login?ReturnUrl=%2froot",{waitUntil:"domcontentloaded"});
  process.stdout.write("Official SMS opened. Sign in privately and open the grades view. No credentials in chat. Press Enter here when ready.\n");
  const input=createInterface({input:process.stdin,output:process.stdout});
  while (await input.question("inspect / close: ") !== "close") {
  const structure=await page.evaluate(()=>{
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
  });
  process.stdout.write(JSON.stringify({notice:"SANITIZED STRUCTURE; numeric grades replaced with synthetic examples",responseShapes:Object.fromEntries(responseShapes),routes:[...routes.values()].filter(r=>!(/\.(?:png|jpg|gif|css|woff2)$/.test(r.path)||/sencha|appjs/.test(r.path))),structure})+"\n");
  }
  input.close();
} finally {await context.close();await browser.close();}
