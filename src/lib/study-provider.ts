import {studyInstructions,studyResponse,validateStudyResponse,type SourcePage,type StudyInput,type StudyResponse} from "./ai-study";
import {z} from "zod";
export interface StudyProvider {generate(input:StudyInput,pages:SourcePage[]):Promise<StudyResponse>}
export class StudyProviderError extends Error{constructor(readonly code:"quota"|"failed"){super(code);}}
export function geminiProvider(config:{key:string;model:string;timeoutMs:number},transport:typeof fetch=fetch):StudyProvider{
 return {async generate(input,pages){
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),config.timeoutMs);
  try{
   if(!/^gemini-[a-z0-9.-]{1,100}$/.test(config.model))throw new StudyProviderError("failed");
   const response=await transport(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,{
    method:"POST",signal:abort.signal,cache:"no-store",redirect:"error",
    headers:{"Content-Type":"application/json","x-goog-api-key":config.key},
    body:JSON.stringify({systemInstruction:{parts:[{text:studyInstructions(input.mode,input.locale)}]},
     contents:[{role:"user",parts:[{text:JSON.stringify({pages})}]}],
     generationConfig:{temperature:0.2,candidateCount:1,maxOutputTokens:6000,responseMimeType:"application/json",responseJsonSchema:z.toJSONSchema(studyResponse)}})
   });
   if(response.status===429)throw new StudyProviderError("quota");
   if(!response.ok)throw new StudyProviderError("failed");
   // Bound provider output even when a proxy/provider behaves unexpectedly.
   const reader=response.body?.getReader();if(!reader)throw new StudyProviderError("failed");
   const chunks:Uint8Array[]=[];let size=0;
   try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>200000){await reader.cancel();throw new StudyProviderError("failed");}chunks.push(next.value);}}finally{reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   const body=z.object({candidates:z.array(z.object({finishReason:z.literal("STOP"),content:z.object({parts:z.array(z.object({text:z.string().optional(),thought:z.boolean().optional()}))})})).min(1).max(1)}).parse(JSON.parse(new TextDecoder().decode(bytes)));
   const text=body.candidates[0].content.parts.filter(p=>!p.thought).map(p=>p.text??"").join("");
   return validateStudyResponse(JSON.parse(text),pages,input.mode);
  }catch(error){throw error instanceof StudyProviderError?error:new StudyProviderError("failed");}
  finally{clearTimeout(timer);}
 }};
}
