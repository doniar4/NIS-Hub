// Real production build, public routes, no auth bypass or UI/DOM replacement.
import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import {spawn} from "node:child_process";
import {readFileSync} from "node:fs";
import {chromium,webkit,devices,expect} from "@playwright/test";
import sharp from "sharp";

test("Built Home Screen metadata/icons are public, nonduplicated and fetchable in mobile Chromium/WebKit",{timeout:90000},async()=>{
  const reserve=createServer();reserve.listen(0,"127.0.0.1");await once(reserve,"listening");
  const address=reserve.address();assert.ok(address&&typeof address!=="string");
  const port=address.port;await new Promise<void>(r=>reserve.close(()=>r()));
  const origin=`http://127.0.0.1:${port}`;
  const app=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p",String(port)],{stdio:["ignore","pipe","pipe"]});
  let output="";app.stdout.on("data",v=>{output+=v.toString();});app.stderr.on("data",v=>{output+=v.toString();});
  try{
    let ready=false;
    for(let i=0;i<100;i++){
      if(app.exitCode!==null)throw new Error("Local production server failed to start");
      try{const r=await fetch(origin+"/manifest.webmanifest",{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}
      await new Promise(r=>setTimeout(r,100));
    }
    assert.ok(ready,"production manifest must be available");
    for(const [engine,device]of [[chromium,devices["Pixel 7"]],[webkit,devices["iPhone 13"]]]as const){
      const browser=await engine.launch({headless:true});
      try{
        const context=await browser.newContext({...device});const page=await context.newPage();
        await page.goto(origin+"/",{waitUntil:"domcontentloaded"});
        await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
        await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
        await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
        await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content","NIS Hub");
        await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content","yes");
        await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute("content","yes");

        const icon=page.locator('link[rel="icon"]'),apple=page.locator('link[rel="apple-touch-icon"]');
        const oldHref=await icon.getAttribute("href");assert.ok(oldHref?.startsWith("/icon.png"));
        const favicon=await context.request.get(origin+oldHref);assert.equal(favicon.status(),200);
        assert.deepEqual(await favicon.body(),readFileSync("src/app/icon.png"),"existing browser favicon is unchanged");
        assert.equal(await apple.getAttribute("sizes"),"180x180");
        const touch=await context.request.get(new URL((await apple.getAttribute("href"))!,origin).href);
        assert.equal(touch.status(),200);assert.match(touch.headers()["content-type"],/image\/png/);
        const touchSize=await sharp(await touch.body()).metadata();assert.equal(touchSize.width,180);assert.equal(touchSize.height,180);

        const manifestUrl=new URL((await page.locator('link[rel="manifest"]').getAttribute("href"))!,origin);
        assert.equal(manifestUrl.origin,origin,"manifest remains same-origin, not a preview/production redirect");
        const response=await context.request.get(manifestUrl.href);assert.equal(response.status(),200);assert.match(response.headers()["content-type"],/application\/manifest\+json/);
        const manifest=await response.json();assert.equal(manifest.name,"NIS Hub");assert.equal(manifest.short_name,"NIS Hub");assert.equal(manifest.display,"standalone");assert.equal(manifest.start_url,"/");
        for(const entry of manifest.icons){
          const image=await context.request.get(new URL(entry.src,origin).href);assert.equal(image.status(),200);
          assert.match(image.headers()["content-type"],/image\/png/);
          const meta=await sharp(await image.body()).metadata();assert.equal(`${meta.width}x${meta.height}`,entry.sizes);
        }
        await context.close();
      }finally{await browser.close();}
    }
    assert.ok(!output.includes("Error:"),"production server must serve metadata without runtime errors");
  }finally{app.kill("SIGTERM");if(app.exitCode===null)await once(app,"exit");}
});
