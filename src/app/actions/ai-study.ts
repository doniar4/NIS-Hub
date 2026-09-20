"use server";
import {z} from "zod";
import {studyDebug} from "@/lib/ai-study-diagnostics";
import {actionContext} from "@/lib/auth";
import {aiStudyConfig} from "@/lib/ai-study-config";
import {studyInput,validateStudyResponse,type StudyResult} from "@/lib/ai-study";
import {geminiProvider,StudyProviderError} from "@/lib/study-provider";
import {sourceHash,cacheSignature,validCacheSignature,STUDY_PROMPT_VERSION} from "@/lib/study-cache";
const reservationSchema=z.object({state:z.enum(["cached","busy","quota","reserved"]),generation:z.object({id:z.uuid(),lease:z.uuid(),response:z.string().nullable(),signature:z.string().nullable()}).optional()});
export async function generateStudy(raw:unknown):Promise<StudyResult>{
 const config=aiStudyConfig();
 if(!config.enabled){studyDebug("disabled");return {error:"disabled"};}
 const parsed=studyInput.safeParse(raw);if(!parsed.success){studyDebug("invalid-input");return {error:"unavailable"};}
 const input=parsed.data;
 if(input.end-input.start+1>config.maxPages){studyDebug("range-too-large");return {error:"unavailable"};}
 let fail:(()=>Promise<unknown>)|undefined;
 try{
  const {supabase,user}=await actionContext();
  const edition=await supabase.from("book_variants").select("book_id,publication_status,content_revision,page_count").eq("id",input.variantId).maybeSingle();
  if(edition.error||!edition.data||edition.data.publication_status!=="published"||(edition.data.page_count&&input.end>edition.data.page_count)){studyDebug("edition-unavailable");return {error:"unavailable"};}
  const book=await supabase.from("books").select("publication_status").eq("id",edition.data.book_id).maybeSingle();
  if(book.error||book.data?.publication_status!=="published"){studyDebug("book-unavailable");return {error:"unavailable"};}
  const revision=edition.data.content_revision;
  const extracted=await supabase.from("book_extractions").select("status,content_revision").eq("book_variant_id",input.variantId).maybeSingle();
  if(extracted.error||extracted.data?.status!=="ready"||extracted.data.content_revision!==revision){studyDebug("extraction-unavailable");return {error:"unavailable"};}
  const result=await supabase.from("book_pages").select("page_number,text,text_hash").eq("book_variant_id",input.variantId).eq("content_revision",revision)
   .gte("page_number",input.start).lte("page_number",input.end).order("page_number").limit(10);
  if(result.error||result.data.length!==input.end-input.start+1){studyDebug("pages-unavailable");return {error:"unavailable"};}
  const chars=result.data.reduce((sum,p)=>sum+p.text.length,0);
  if(chars<80||chars>config.maxChars){studyDebug("source-size-invalid");return {error:"unavailable"};}
  const hash=sourceHash(result.data),model=config.model+":"+STUDY_PROMPT_VERSION;
  const context=[user.id,input.variantId,revision,input.start,input.end,input.mode,input.locale,hash,model];
  const reservation=await supabase.rpc("reserve_ai_study",{p_variant:input.variantId,p_revision:revision,p_start:input.start,p_end:input.end,p_mode:input.mode,p_locale:input.locale,p_hash:hash,p_model:model,p_limit:config.dailyLimit});
  if(reservation.error){studyDebug("reservation-error");return {error:"unavailable"};}
  const reserved=reservationSchema.parse(reservation.data);
  if(reserved.state==="busy"||reserved.state==="quota"){studyDebug("reservation-state",{code:reserved.state});return {error:reserved.state};}
  const g=reserved.generation;if(!g){studyDebug("missing-generation");return {error:"failed"};}
  const source={start:input.start,end:input.end,variantId:input.variantId,hash},pages=result.data.map(p=>({page:p.page_number,text:p.text}));
  if(reserved.state==="cached"){
   if(!g.response||!g.signature||!validCacheSignature(config.key,context,g.response,g.signature)){studyDebug("cache-invalid");return {error:"failed"};}
   return {response:validateStudyResponse(JSON.parse(g.response),pages,input.mode),cached:true,source,generationId:g.id};
  }
  fail=async()=>supabase.rpc("complete_ai_study",{p_id:g.id,p_lease:g.lease,p_response:"",p_signature:"",p_failed:true});
  const response=await geminiProvider(config).generate(input,pages),serialized=JSON.stringify(response);
  const saved=await supabase.rpc("complete_ai_study",{p_id:g.id,p_lease:g.lease,p_response:serialized,p_signature:cacheSignature(config.key,context,serialized),p_failed:false});
  if(saved.error||!saved.data){studyDebug("save-generation-failed");await fail();return {error:"unavailable"};}
  return {response,cached:false,source,generationId:g.id};
 }catch(error){
  if(fail)await fail().catch(()=>{});
  if(error instanceof StudyProviderError){
   studyDebug("provider-error",{code:error.code,providerStage:error.stage,httpStatus:error.httpStatus});
   return {error:error.code};
  }
  studyDebug("unexpected-error");
  return {error:"failed"};
 }
}
