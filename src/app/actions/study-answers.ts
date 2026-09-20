"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { actionContext } from "@/lib/auth";
import { aiStudyConfig } from "@/lib/ai-study-config";
import { sourceHash,validCacheSignature,STUDY_PROMPT_VERSION } from "@/lib/study-cache";
import { validateStudyResponse } from "@/lib/ai-study";
import { answerReviewInput,selfCheckQuestions,type AnswerReviewResult } from "@/lib/study-answer-review";
import { geminiProvider,StudyProviderError } from "@/lib/study-provider";
export async function reviewStudyAnswers(raw:unknown):Promise<AnswerReviewResult>{
 const config=aiStudyConfig(),parsed=answerReviewInput.safeParse(raw);
 if(!config.enabled)return {error:"disabled"};
 if(!parsed.success)return {error:"unavailable"};
 let settle:(()=>Promise<unknown>)|undefined;
 try{
 const {supabase,user}=await actionContext();
 const original=await supabase.from("ai_study_generations").select("*").eq("id",parsed.data.generationId).eq("user_id",user.id).maybeSingle(),g=original.data;
 if(original.error||!g||g.status!=="ready"||g.mode!=="questions"||!g.response||!g.signature||!["ru","kk","en"].includes(g.locale)||g.end_page-g.start_page+1>config.maxPages)return {error:"unavailable"};
 const expectedModel=config.model+":"+STUDY_PROMPT_VERSION;
 if(g.model_key!==expectedModel||!validCacheSignature(config.key,[user.id,g.book_variant_id,g.content_revision,g.start_page,g.end_page,g.mode,g.locale,g.source_hash,g.model_key],g.response,g.signature))return {error:"unavailable"};
 // RLS validates current book/edition publication and revision again.
 const result=await supabase.from("book_pages").select("page_number,text,text_hash").eq("book_variant_id",g.book_variant_id).eq("content_revision",g.content_revision).gte("page_number",g.start_page).lte("page_number",g.end_page).order("page_number").limit(10);
 if(result.error||result.data.length!==g.end_page-g.start_page+1||sourceHash(result.data)!==g.source_hash||result.data.reduce((n,p)=>n+p.text.length,0)>config.maxChars)return {error:"unavailable"};
 const pages=result.data.map(p=>({page:p.page_number,text:p.text})),questions=selfCheckQuestions(validateStudyResponse(JSON.parse(g.response),pages,"questions"));
 const answers=parsed.data.answers.map(a=>({index:a.index,question:questions[a.index]?.text??"",answer:a.text}));
 if(answers.some(a=>!a.question))return {error:"unavailable"};
 // Unique, metadata-only attempt uses the same atomic daily quota. Neither answers
 // nor review feedback are written to the cache. Existing generation cache is untouched.
 const reserved=await supabase.rpc("reserve_ai_study",{p_variant:g.book_variant_id,p_revision:g.content_revision,p_start:g.start_page,p_end:g.end_page,p_mode:"questions",p_locale:g.locale,p_hash:g.source_hash,p_model:"answer-review-v053:"+randomUUID(),p_limit:config.dailyLimit});
 if(reserved.error)return {error:"unavailable"};
 const reservation=z.object({state:z.enum(["reserved","quota","busy","cached"]),generation:z.object({id:z.uuid(),lease:z.uuid()}).optional()}).parse(reserved.data);
 if(reservation.state==="quota"||reservation.state==="busy")return {error:reservation.state};
 if(reservation.state!=="reserved"||!reservation.generation)return {error:"failed"};
 const attempt=reservation.generation;
 settle=async()=>supabase.rpc("complete_ai_study",{p_id:attempt.id,p_lease:attempt.lease,p_response:"",p_signature:"",p_failed:true});
 const response=await geminiProvider(config).reviewStudyAnswers(g.locale as "ru"|"kk"|"en",pages,answers);
 // Recheck authorization after a provider request; never serve a withdrawn source.
 const current=await supabase.from("ai_study_generations").select("id").eq("id",g.id).maybeSingle();
 await settle();settle=undefined;
 if(current.error||!current.data)return {error:"unavailable"};
 return {response,source:{start:g.start_page,end:g.end_page,variantId:g.book_variant_id,hash:g.source_hash}};
 }catch(error){if(settle)await settle().catch(()=>{});return {error:error instanceof StudyProviderError?error.code:"failed"};}
}
