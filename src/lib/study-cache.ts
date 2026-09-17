import {createHash,createHmac,timingSafeEqual} from "node:crypto";
export const STUDY_PROMPT_VERSION="nis-source-v051-1";
export function sourceHash(pages:{page_number:number;text_hash:string}[]){return createHash("sha256").update(pages.map(p=>p.page_number+":"+p.text_hash).join(",")).digest("hex");}
export function cacheSignature(secret:string,context:unknown,response:string){return createHmac("sha256",secret).update("nis-ai-cache-v1\n"+JSON.stringify(context)+"\n"+response).digest("hex");}
export function validCacheSignature(secret:string,context:unknown,response:string,signature:string){
 const expected=cacheSignature(secret,context,response);
 return /^[a-f0-9]{64}$/.test(signature)&&timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(signature,"hex"));
}
