import sharp from "sharp";
import {mkdir} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const source=resolve(root,"src/app/icon.png");
const background="#0b1728";

// Reuse the actual favicon. No new artwork, rounded mask or upscale.
// Its original rounded frame is part of the source, not added here.
export async function homeScreenIcons(){
  const meta=await sharp(source).metadata();
  if(meta.width!==500||meta.height!==500)throw new Error("Review home-screen icon padding when the favicon source changes.");
  const image=sharp(source).flatten({background});
  const [apple,small,large,maskable]=await Promise.all([
    image.clone().resize(180,180,{withoutEnlargement:true}).png().toBuffer(),
    image.clone().resize(192,192,{withoutEnlargement:true}).png().toBuffer(),
    // 500px source stays 500px; only the 512px canvas is larger.
    image.clone().extend({top:6,bottom:6,left:6,right:6,background}).png().toBuffer(),
    // Safe padding lets Android apply its own shape without cutting the sprout.
    image.clone().resize(384,384,{withoutEnlargement:true}).extend({top:64,bottom:64,left:64,right:64,background}).png().toBuffer(),
  ]);
  return [
    {path:"src/app/apple-icon.png",buffer:apple},
    {path:"public/icons/icon-192.png",buffer:small},
    {path:"public/icons/icon-512.png",buffer:large},
    {path:"public/icons/icon-maskable-512.png",buffer:maskable},
  ];
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  for(const {path,buffer} of await homeScreenIcons()){
    const target=resolve(root,path);
    await mkdir(dirname(target),{recursive:true});
    await sharp(buffer).toFile(target);
    console.log("Prepared "+path);
  }
}
