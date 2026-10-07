import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import sharp from "sharp";
import manifest from "../src/app/manifest";

test("Home Screen manifest uses stable name, standalone root launch and same-origin PNG icons",async()=>{
  const m=manifest();
  assert.equal(m.name,"NIS Hub");assert.equal(m.short_name,"NIS Hub");
  assert.equal(m.start_url,"/");assert.equal(m.scope,"/");assert.equal(m.id,"/");assert.equal(m.display,"standalone");
  assert.deepEqual(m.icons?.map(icon=>[icon.sizes,icon.purpose]),[["192x192","any"],["512x512","any"],["512x512","maskable"]]);
  for(const icon of m.icons??[]){
    assert.match(icon.src,/^\/icons\/[a-z0-9-]+\.png$/);
    const meta=await sharp(readFileSync("public"+icon.src)).metadata();
    assert.equal(meta.format,"png");assert.equal(`${meta.width}x${meta.height}`,icon.sizes);
    assert.equal(meta.hasAlpha,false,"Home Screen backgrounds are opaque, not transparent corners");
  }
});

test("iOS has one file-based 180px apple icon; metadata enables standalone without replacing the favicon",async()=>{
  const apple=await sharp("src/app/apple-icon.png").metadata();
  assert.equal(apple.width,180);assert.equal(apple.height,180);assert.equal(apple.format,"png");assert.equal(apple.hasAlpha,false);
  const source=await sharp("src/app/icon.png").metadata();assert.equal(source.width,500);assert.equal(source.height,500);
  const layout=readFileSync("src/app/layout.tsx","utf8");
  assert.match(layout,/appleWebApp:\s*\{ capable: true, title: "NIS Hub"/);
  assert.match(layout,/"apple-mobile-web-app-capable": "yes"/);
  assert.doesNotMatch(layout,/icons:\s*\{|manifest:\s*|<link[^>]+(?:manifest|apple-touch-icon)/,"file-based metadata must not be duplicated");
});

test("512px icon preserves source pixels without upscaling; Android maskable keeps sprout in safe zone",async()=>{
  const source=await sharp("src/app/icon.png").flatten({background:"#0b1728"}).removeAlpha().raw().toBuffer();
  const actual=await sharp("public/icons/icon-512.png").extract({left:6,top:6,width:500,height:500}).removeAlpha().raw().toBuffer();
  assert.deepEqual(actual,source,"512 canvas contains the original 500px image unchanged");
  const {data,info}=await sharp("public/icons/icon-maskable-512.png").removeAlpha().raw().toBuffer({resolveWithObject:true});
  let bluePixels=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const i=(y*info.width+x)*info.channels,[r,g,b]=data.subarray(i,i+3);
    if(b>130&&g>r+25&&b>r+50){
      bluePixels++;
      assert.ok(Math.hypot(x-256,y-256)<=512*.4,"existing blue sprout remains within Android's maskable safe circle");
    }
  }
  assert.ok(bluePixels>1000,"maskable retains the actual blue sprout, not an empty background");
});
