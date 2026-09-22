"use server";
import {revalidatePath} from "next/cache";
import {actionContext} from "@/lib/auth";
import {getCatalogOptions} from "@/lib/queries";
import {getWeeklySchedule} from "@/lib/weekly-queries";
import {fetchEduPage} from "@/lib/edupage/schedule";
import {prepareEduPage,type EduPagePreview} from "@/lib/edupage/service";
import {validateAliases} from "@/lib/edupage/mapping";
import {EduPageError,safeEduPageError,type EduPageErrorCode} from "@/lib/edupage/errors";
export type EduPageActionResult={preview?:EduPagePreview;error?:EduPageErrorCode;checkedAt?:string;version?:string;synced?:boolean;unchanged?:boolean};
export async function syncEduPage(input:unknown):Promise<EduPageActionResult>{
  let context:Awaited<ReturnType<typeof actionContext>>;
  try{context=await actionContext(true);}catch{return {error:"admin"};}
  const {supabase}=context;
  try{
    if(!input||typeof input!=="object"||Array.isArray(input)||JSON.stringify(input).length>200000)throw new EduPageError("mapping");
    const value=input as Record<string,unknown>,aliases=validateAliases(value.aliases);
    if(!Array.isArray(value.scope)||value.scope.length>200||value.scope.some(id=>typeof id!=="string"||id.length>100)||
      new Set(value.scope).size!==value.scope.length)throw new EduPageError("mapping");
    if(value.intent!=="preview"&&value.intent!=="confirm")throw new EduPageError("confirmation");
    if(value.intent==="confirm"&&(value.confirm!==true||typeof value.fingerprint!=="string"||!/^[a-f0-9]{64}$/.test(value.fingerprint)))
      throw new EduPageError("confirmation");
    // Refetch on confirmation: no client-supplied lesson or provider response is trusted.
    const live=await fetchEduPage();
    const [{classes,subjects},lessons,active]=await Promise.all([getCatalogOptions(),getWeeklySchedule(),
      supabase.from("schedule_import_batches").select("id").eq("status","active").single()]);
    if(active.error||!active.data)throw new EduPageError("database");
    const preview=prepareEduPage(live.snapshot,live.sourceHash,active.data.id,lessons,classes,subjects,aliases,value.scope as string[]);
    if(value.intent==="preview"){
      const {error}=await supabase.from("edupage_sync_state").upsert({id:true,last_checked:live.checkedAt,
        last_error:preview.scope.length?null:"mapping"});
      if(error)throw new EduPageError("database");
      return {preview,checkedAt:live.checkedAt};
    }
    if(value.fingerprint!==preview.fingerprint)throw new EduPageError("stale");
    // Safe partial sync: classes with unresolved mappings/conflicts are excluded
    // from preview.scope/rows, so their existing timetable is preserved.
    if(!preview.scope.length||!preview.rows.length)throw new EduPageError("mapping");
    if(!preview.diff.added.length&&!preview.diff.changed.length&&!preview.diff.removed.length){
      const {error}=await supabase.from("edupage_sync_state").upsert({id:true,aliases,
        last_checked:live.checkedAt,last_error:null});
      if(error)throw new EduPageError("database");
      return {unchanged:true,checkedAt:live.checkedAt,version:active.data.id};
    }
    const {data,error}=await supabase.rpc("sync_edupage_schedule",{p_lessons:preview.rows,p_classes:preview.scope,
      p_expected_active:preview.activeVersion,p_note:"EduPage "+preview.publication.number+" · "+preview.publication.effectiveFrom,
      p_aliases:aliases});
    if(error||!data)throw new EduPageError(error?.code==="40001"?"stale":"database");
    revalidatePath("/","layout");
    return {synced:true,version:data,checkedAt:live.checkedAt};
  }catch(error){
    const code=safeEduPageError(error);
    // Only bounded error codes are stored; no response bodies, credentials or logs.
    await supabase.from("edupage_sync_state").upsert({id:true,last_checked:new Date().toISOString(),last_error:code});
    return {error:code};
  }
}
