import {chromium,expect} from "@playwright/test";
import {createServer} from "node:http";
import {createReadStream} from "node:fs";
import {stat,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {once} from "node:events";
import {spawnSync} from "node:child_process";
const file=resolve(import.meta.dirname,"nis-hub-promo.mp4"),info=await stat(file);
if(info.size<100000)throw Error("Video absent or unexpectedly small");
const decoded=spawnSync(process.env.FFMPEG||"/opt/homebrew/bin/ffmpeg",["-v","error","-xerror","-i",file,"-f","null","-"],{encoding:"utf8"});
if(decoded.status!==0)throw Error("Full video decoding failed");
const server=createServer((req,res)=>{
 if(req.url!=="/nis-hub-promo.mp4"){res.writeHead(404);res.end();return;}
 const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
 const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),info.size-1):info.size-1;
 if(start>end||start>=info.size){res.writeHead(416,{"Content-Range":"bytes */"+info.size});res.end();return;}
 res.writeHead(range?206:200,{"Content-Type":"video/mp4","Accept-Ranges":"bytes","Content-Length":end-start+1,...(range?{"Content-Range":"bytes "+start+"-"+end+"/"+info.size}:{})});
 if(req.method==="HEAD"){res.end();return;}
 createReadStream(file,{start,end}).pipe(res);
});
server.listen(0,"127.0.0.1");await once(server,"listening");
const browser=await chromium.launch({headless:true});
try{
 const address=server.address(),page=await browser.newPage({viewport:{width:1920,height:1080}});
 const errors=[];page.on("pageerror",error=>errors.push(error.name));
 await page.goto("http://127.0.0.1:"+address.port+"/nis-hub-promo.mp4",{waitUntil:"domcontentloaded"});
 const video=page.locator("video");await expect(video).toBeVisible();
 await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);
 await video.evaluate(async v=>{v.muted=true;await v.play();});
 await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(1);
 const metadata=await video.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,decodedFrames:v.getVideoPlaybackQuality().totalVideoFrames}));
 if(metadata.width!==1920||metadata.height!==1080||Math.abs(metadata.duration-32)>.05||metadata.decodedFrames<10)throw Error("Browser metadata/playback mismatch");
 await video.evaluate(v=>{v.currentTime=29;});
 await expect.poll(()=>video.evaluate(v=>v.ended),{timeout:12000}).toBe(true);
 if(errors.length)throw Error("Browser playback errors");
 const report={file:"promo/nis-hub-promo.mp4",size:info.size,fullDecode:"pass",browser:"Chromium",...metadata,seekTo29AndEnd:"pass",errors};
 await writeFile(join(import.meta.dirname,"playback-verification.json"),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{
 await browser.close();server.closeAllConnections();server.close();await once(server,"close");
}
