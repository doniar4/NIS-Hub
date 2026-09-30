import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

test("SMS manual challenge keeps credentials and prior answers, refreshes CAPTCHA, and cancels cleanly", {timeout:60000}, async()=>{
  const bundle=await build({stdin:{contents:'import {createRoot} from "react-dom/client";import {SmsDiary} from "./src/components/sms-diary";createRoot(document.getElementById("root")).render(<SmsDiary enabled sessionPresent={false}/>);',resolveDir:process.cwd(),loader:"tsx"},bundle:true,write:false,platform:"browser",format:"esm",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"'},plugins:[{name:"sms-fixture",setup(api){
    api.onResolve({filter:/^@\/app\/actions\/sms$/},()=>({path:"actions",namespace:"fixture"}));
    api.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:["connectSms","continueSmsLogin","sendSmsLoginCode","cancelSmsLogin","disconnectSms","refreshSms","loadSmsSubject"].map(name=>`export async function ${name}(form){return (await fetch('/rpc',{method:'POST',body:JSON.stringify({name:'${name}',form:form instanceof FormData?Object.fromEntries(form):{}})})).json();}`).join("\n"),loader:"js"}));
  }}]});
  const imageA="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=";
  const imageB=imageA+"\n";
  const calls:{name:string;form:Record<string,string>}[]=[];
  let stage=0;
  const challenge={captcha:true,twoFactor:false,application2FA:false,image:imageA,expiresAt:Date.now()+60000};
  const css=readdirSync(".next/static/css").filter(name=>name.endsWith(".css")).map(name=>readFileSync(resolve(".next/static/css",name),"utf8")).join("\n");
  const server=createServer(async(req,res)=>{
    if(req.url==="/bundle.js"){res.setHeader("Content-Type","application/javascript");res.end(bundle.outputFiles[0].contents);return;}
    if(req.url==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css);return;}
    if(req.url==="/rpc"){
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);
      const call=JSON.parse(Buffer.concat(chunks).toString());calls.push(call);
      let result:unknown={connected:false};
      if(call.name==="connectSms")result={connected:false,challenge};
      if(call.name==="continueSmsLogin"){
        stage++;
        result=stage===1?{connected:false,challenge:{...challenge,image:imageB,twoFactor:true}}:stage===2?{connected:false,challenge:{...challenge,captcha:false,image:undefined,application2FA:true}}:{connected:true};
      }
      if(call.name==="sendSmsLoginCode")result={connected:false,challenge:{...challenge,image:undefined,twoFactor:true,resendAt:Date.now()+60000}};
      res.setHeader("Content-Type","application/json");res.end(JSON.stringify(result));return;
    }
    res.setHeader("Content-Type","text/html");res.end('<html lang="ru"><head><link rel="stylesheet" href="/style.css"></head><body><main style="padding:20px"><div id="root"></div></main><script type="module" src="/bundle.js"></script></body></html>');
  });
  server.listen(0,"127.0.0.1");await once(server,"listening");
  const browser=await chromium.launch({headless:true,executablePath:process.env.NIS_CHROMIUM_PATH??"/usr/lib/chromium/chromium",args:["--no-sandbox"]});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce"});
    await page.goto(`http://127.0.0.1:${(server.address() as {port:number}).port}`);
    await page.locator("#sms-iin").fill("123456789012");await page.locator("#sms-password").fill("fixture-password");
    await page.getByRole("button",{name:"Подключить SMS",exact:true}).click();
    await expect(page.locator("#sms-captcha")).toBeVisible();
    await expect(page.locator("#sms-password")).toHaveCount(0);
    await page.locator("#sms-captcha").fill("first");await page.getByRole("button",{name:"Продолжить вход",exact:true}).click();
    await expect(page.locator("#sms-two-factor")).toBeVisible();await expect(page.locator("#sms-captcha")).toHaveValue("");
    await page.locator("#sms-captcha").fill("second");await page.getByRole("button",{name:"Отправить код",exact:true}).click();
    await expect(page.getByRole("button",{name:"Повторная отправка доступна через минуту"})).toBeDisabled();
    await expect(page.locator("#sms-captcha")).toHaveValue("second");
    await expect(page.locator('img[alt="CAPTCHA школьной системы SMS"]')).toHaveAttribute("src",imageB);
    mkdirSync("/tmp/nis-sms-browser",{recursive:true});await page.screenshot({path:"/tmp/nis-sms-browser/challenge-mobile.png",fullPage:true});
    await page.locator("#sms-two-factor").fill("1234");await page.getByRole("button",{name:"Продолжить вход",exact:true}).click();
    await expect(page.locator("#sms-application-code")).toBeVisible();
    await page.locator("#sms-application-code").fill("123456");await page.getByRole("button",{name:"Продолжить вход",exact:true}).click();
    await expect(page.getByText("SMS подключён",{exact:true})).toBeVisible();
    const final=calls.filter(call=>call.name==="continueSmsLogin").at(-1)!;
    assert.deepEqual(final.form,{iin:"123456789012",password:"fixture-password",captchaInput:"second",twoFactorAuthCode:"1234",application2FACode:"123456"});
    assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes("fixture-password")),false);
    await page.reload();await page.locator("#sms-iin").fill("123456789012");await page.locator("#sms-password").fill("fixture-password");await page.getByRole("button",{name:"Подключить SMS",exact:true}).click();
    await page.getByRole("button",{name:"Отменить",exact:true}).click();await expect(page.locator("#sms-password")).toHaveValue("");await expect(page.locator("#sms-iin")).toHaveValue("");
  }finally{await browser.close();server.close();await once(server,"close");}
});
