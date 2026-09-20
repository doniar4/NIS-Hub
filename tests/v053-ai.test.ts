import test from "node:test";
import assert from "node:assert/strict";
import { answerReviewInput,validateAnswerReview } from "../src/lib/study-answer-review";
import { geminiProvider } from "../src/lib/study-provider";
const pages=[{page:7,text:"Photosynthesis uses light energy. Chlorophyll absorbs light."}],answers=[{index:0,question:"What absorbs light?",answer:"Chlorophyll."}];
const result={feedback:[{index:0,status:"correct",feedback:"Supported by the selected text.",evidence:[{page:7,quote:"Chlorophyll absorbs light."}]}],topicsToReview:[]};
test("Answer review enforces source pages, quotes, status evidence, original question indices and bounded answers",()=>{
 assert.deepEqual(validateAnswerReview(result,pages,answers),result);
 assert.throws(()=>validateAnswerReview(result,[{...pages[0],page:8}],answers),/citation/);
 assert.throws(()=>validateAnswerReview(result,[{page:7,text:"Other source text."}],answers),/citation/);
 assert.throws(()=>validateAnswerReview({...result,feedback:[...result.feedback,...result.feedback]},pages,answers),/indices/);
 assert.throws(()=>validateAnswerReview({...result,feedback:[{...result.feedback[0],index:1}]},pages,answers),/indices/);
 assert.throws(()=>validateAnswerReview({...result,feedback:[{...result.feedback[0],evidence:[]}]},pages,answers),/evidence/);
 assert.equal(validateAnswerReview({...result,feedback:[{...result.feedback[0],status:"insufficient",evidence:[]}]},pages,answers).feedback[0].status,"insufficient");
 for(const value of [{generationId:crypto.randomUUID(),answers:[]},{generationId:crypto.randomUUID(),answers:[{index:0,text:"x".repeat(1001)}]},{generationId:crypto.randomUUID(),answers:[{index:0,text:"ok"},{index:0,text:"again"}]},{generationId:crypto.randomUUID(),answers:[{index:0,text:"ok"}],questions:["forged"]}])assert.equal(answerReviewInput.safeParse(value).success,false);
});
test("Review transport shares timeout/quota/privacy protections and sends only supplied pages/questions/answers",async()=>{
 const provider=geminiProvider({key:"fixture-only",model:"gemini-test",timeoutMs:1000},async(url,init)=>{
 assert.ok(!String(url).includes("fixture-only"));const body=JSON.parse(String(init?.body));
 assert.deepEqual(JSON.parse(body.contents[0].parts[0].text),{pages,answers});assert.equal(body.tools,undefined);
 assert.match(body.systemInstruction.parts[0].text,/untrusted DATA/);assert.match(body.systemInstruction.parts[0].text,/official/);
 return Response.json({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify(result)}]}}]});
 });
 assert.deepEqual(await provider.reviewStudyAnswers("en",pages,answers),result);
 await assert.rejects(geminiProvider({key:"fixture",model:"gemini-test",timeoutMs:50},async()=>new Response("",{status:429})).reviewStudyAnswers("en",pages,answers),{message:"provider_quota"});
});
