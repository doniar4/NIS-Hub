import test from "node:test";
import assert from "node:assert/strict";
import {studyDebug} from "../src/lib/ai-study-diagnostics";
import {geminiProvider,StudyProviderError} from "../src/lib/study-provider";
import {validateStudyResponse} from "../src/lib/ai-study";
const input={variantId:"00000000-0000-4000-8000-000000000030",start:1,end:1,mode:"summary" as const,locale:"ru" as const};
const pages=[{page:1,text:"A vector has a magnitude and a direction. Two equal vectors have the same magnitude and direction."}];
const answer={insufficient:false,sections:[{kind:"overview",insufficient:false,points:[{text:"A vector has two properties.",evidence:[{page:1,quote:"A vector has a magnitude and a direction."}]}]}]};
test("Gemini configuration failures are actionable and never leak raw provider details",async()=>{
 for(const status of [400,401,403,404,429,500]){
  const provider=geminiProvider({key:"private-key-fixture",model:"gemini-test",timeoutMs:100},async()=>Response.json({error:{message:"private-key-fixture https://private.invalid?token=secret"}},{status}));
  await assert.rejects(provider.generate(input,pages),(error:unknown)=>error instanceof StudyProviderError
   &&error.code===(status===429?"provider_quota":status<500?"configuration":"failed")
   &&error.httpStatus===status&&error.stage==="http"
   &&!error.message.includes("private"));
 }
});
test("Small provider grammar retains strict response limits and grounded-citation validation locally",async()=>{
 const provider=geminiProvider({key:"fixture",model:"gemini-test",timeoutMs:100},async(_url,init)=>{
  const body=JSON.parse(String(init?.body)),schema=JSON.stringify(body.generationConfig.responseJsonSchema);
  assert.ok(!/maxItems|minItems|minimum|additionalProperties/.test(schema));
  assert.equal(body.generationConfig.responseMimeType,"application/json");
  assert.equal(body.generationConfig.responseJsonSchema.properties.sections.items.properties.kind.enum.includes("overview"),true);
  return Response.json({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify(answer)}]}}]});
 });
 assert.deepEqual(await provider.generate(input,pages),answer);
 const tooLong=structuredClone(answer);tooLong.sections[0].points[0].text="x".repeat(1001);
 assert.throws(()=>validateStudyResponse(tooLong,pages,"summary"));
 const invented=structuredClone(answer);invented.sections[0].points[0].evidence[0].page=2;
 assert.throws(()=>validateStudyResponse(invented,pages,"summary"),/citation/);
 const tooMany=structuredClone(answer);tooMany.sections[0].points=Array.from({length:13},()=>answer.sections[0].points[0]);
 assert.throws(()=>validateStudyResponse(tooMany,pages,"summary"));
});
test("AI diagnostics are development-only and discard source text, IDs, exception messages and credentials",t=>{
 const env:Record<string,string|undefined>=process.env,previous=env.NODE_ENV;
 const log=t.mock.method(console,"error",()=>{});
 const details={code:"configuration",providerStage:"http",httpStatus:404,message:"TOKEN secret PDF text",variantId:input.variantId,key:"SECRET",url:"https://private.invalid"};
 try{
  env.NODE_ENV="production";studyDebug("provider-error",details);assert.equal(log.mock.callCount(),0);
  env.NODE_ENV="development";studyDebug("provider-error",details);
  assert.deepEqual(log.mock.calls[0].arguments,["[AI Study]",{stage:"provider-error",code:"configuration",providerStage:"http",httpStatus:404}]);
  studyDebug("SECRET",{code:"SECRET",providerStage:"SECRET",httpStatus:"SECRET"});
  assert.deepEqual(log.mock.calls[1].arguments,["[AI Study]",{stage:"unexpected-error"}]);
 }finally{if(previous===undefined)delete env.NODE_ENV;else env.NODE_ENV=previous;}
});
