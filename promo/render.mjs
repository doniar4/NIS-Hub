import {readFile,mkdir,writeFile,access} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
import {spawnSync} from "node:child_process";
import sharp from "sharp";

const root=resolve(import.meta.dirname,".."),input=process.argv[2];
if(!input)throw Error("Usage: bash promo/build-video.sh promo/assets/<run>/manifest.json");
const manifestPath=resolve(input),assets=dirname(manifestPath);
if(!assets.startsWith(join(root,"promo/assets/")))throw Error("Use an audited capture inside promo/assets");
const manifest=JSON.parse(await readFile(manifestPath,"utf8"));
if(manifest.version!==1||manifest.scenes?.length!==7||manifest.fps!==60||manifest.expectedDuration!==32)throw Error("Incomplete or unsupported capture manifest");
const ffmpeg=process.env.FFMPEG||"/opt/homebrew/bin/ffmpeg";
const ffprobe=process.env.FFPROBE||"/opt/homebrew/bin/ffprobe";
const output=join(root,"promo/nis-hub-promo.mp4");
try{await access(output);throw Error("Output already exists. Preserve/rename it explicitly before rebuilding.");}catch(e){if(e.code!=="ENOENT")throw e;}
const renders=join(assets,"render-"+new Date().toISOString().replace(/[:.]/g,"-"));await mkdir(renders);
const escape=s=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
function ff(args){const r=spawnSync(ffmpeg,["-hide_banner","-loglevel","error","-threads","2",...args],{encoding:"utf8"});if(r.status!==0)throw Error("ffmpeg: "+r.stderr.slice(-1600));}
const videos=[];
for(const [index,s] of manifest.scenes.entries()){
 if(!/^[0-9]{2}-[a-z]+$/.test(s.id)||s.source!=="https://nis-hub-ura.vercel.app"||!s.frameCount||(s.captureKind!=="screenshot"&&s.capturedSeconds<s.duration))throw Error("Scene is not verified production footage");
 const file=resolve(assets,s.file);if(!file.startsWith(assets+"/"))throw Error("Invalid media path");await access(file);
 const durationProbe=s.captureKind==="screenshot"?{status:0,stdout:JSON.stringify({format:{duration:s.duration}})}:spawnSync(ffprobe,["-v","error","-show_entries","format=duration","-of","json",file],{encoding:"utf8"});
 if(durationProbe.status!==0)throw Error("Cannot verify source duration");
 const sourceSeconds=Number(JSON.parse(durationProbe.stdout).format?.duration);
 if(!Number.isFinite(sourceSeconds)||sourceSeconds<=0)throw Error("Invalid source duration");
 // Show the entire real interaction, compressing waits; hold its real final frame.
 const speed=(s.duration-.6)/sourceSeconds;
 const caption=join(renders,s.id+"-caption.png");
 // Editorial captions only: no UI, buttons, data, logo redraw or invented metrics.
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="210"><text x="80" y="88" fill="#f4f7ff" font-family="Arial" font-size="48" font-weight="600">'+escape(s.title)+'</text><text x="83" y="139" fill="#b6c2d9" font-family="Arial" font-size="25">'+escape(s.subtitle)+'</text><text x="1800" y="88" text-anchor="end" fill="#91a6d0" font-family="Arial" font-size="22">'+String(index+1).padStart(2,"0")+' / 07</text></svg>';
 await sharp(Buffer.from(svg)).png().toFile(caption);
 const segment=join(renders,s.id+".mp4"),frames=Math.round(s.duration*60);
 const zoom=index===0?.055:.024;
 const filter="[0:v]setpts=(PTS-STARTPTS)*"+speed.toFixed(8)+",tpad=stop_mode=clone:stop_duration=0.65,fps=60,scale=1760:850:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1920:1080:(ow-iw)/2:64+(850-ih)/2:color=0x080d19,setsar=1,zoompan=z='1+"+zoom+"*sin(min(on/"+frames+",1)*PI/2)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=60,settb=1/60,setpts=PTS-STARTPTS[ui];[1:v]format=rgba,fade=t=in:st=0.12:d=0.3:alpha=1[caption];[ui][caption]overlay=x=0:y='H-210+18*exp(-6*t)':shortest=1,format=yuv420p[out]";
 ff([...(s.captureKind==="screenshot"?["-loop","1","-framerate","60"]:[]),"-i",file,"-loop","1","-framerate","60","-i",caption,"-filter_complex_threads","1","-filter_complex",filter,"-map","[out]","-t",String(s.duration),"-an","-c:v","libx264","-threads","2","-preset","fast","-crf","18","-movflags","+faststart",segment]);
 videos.push(segment);console.log("Rendered "+s.id+" ("+s.duration+" s)");
}
const args=videos.flatMap(file=>["-i",file]),parts=videos.map((_,i)=>"["+i+":v]settb=1/60,setpts=PTS-STARTPTS[v"+i+"]");
let previous="v0",elapsed=manifest.scenes[0].duration;
for(let i=1;i<videos.length;i++){
 const next="x"+i,offset=elapsed-manifest.transition;
 parts.push("["+previous+"][v"+i+"]xfade=transition=fade:duration="+manifest.transition+":offset="+offset.toFixed(3)+"["+next+"]");
 previous=next;elapsed+=manifest.scenes[i].duration-manifest.transition;
}
if(Math.abs(elapsed-32)>.001)throw Error("Incorrect timeline duration");
ff([...args,"-filter_complex_threads","1","-filter_complex",parts.join(";"),"-map","["+previous+"]","-t","32","-r","60","-an","-c:v","libx264","-threads","2","-preset","slow","-crf","18","-pix_fmt","yuv420p","-color_primaries","bt709","-color_trc","bt709","-colorspace","bt709","-metadata","title=NIS Hub — real interface","-movflags","+faststart",output]);
const probe=spawnSync(ffprobe,["-v","error","-count_frames","-show_entries","stream=codec_name,width,height,r_frame_rate,nb_read_frames:format=duration,size","-of","json",output],{encoding:"utf8"});
if(probe.status!==0)throw Error("ffprobe verification failed");
const report=JSON.parse(probe.stdout),video=report.streams?.find(s=>s.codec_name==="h264");
if(!video||video.width!==1920||video.height!==1080||video.r_frame_rate!=="60/1"||video.nb_read_frames!=="1920"||Math.abs(Number(report.format.duration)-32)>.03)throw Error("Video does not meet required format");
await writeFile(join(assets,"video-verification.json"),JSON.stringify(report,null,2));
console.log(output);console.log("Verified: H.264 / 1920×1080 / 60 fps / 32 s / 1920 frames. No music.");
