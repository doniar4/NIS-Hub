"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {actionContext} from "@/lib/auth";
import {dateSchema,uuid} from "@/lib/validation";
import {getI18n} from "@/lib/i18n-server";
import {v05Copy} from "@/lib/v05-copy";
import type {ActionState} from "@/lib/action-state";
export async function saveNonSchoolDay(_:ActionState,form:FormData):Promise<ActionState>{
 const {locale}=await getI18n(),t=v05Copy(locale);
 try{
  const {supabase}=await actionContext(true);
  const parsed=z.object({start_date:dateSchema,end_date:dateSchema,type:z.enum(["holiday","vacation","cancelled","other"]),label:z.string().trim().min(1).max(160)}).safeParse(Object.fromEntries(form));
  if(!parsed.success || parsed.data.end_date<parsed.data.start_date)return {error:t.error};
  const {error}=await supabase.from("non_school_days").insert(parsed.data);if(error)return {error:t.error};
 }catch{return {error:t.error};}
 revalidatePath("/","layout");return {success:t.saved};
}
export async function deleteNonSchoolDay(_:ActionState,form:FormData):Promise<ActionState>{
 const {locale}=await getI18n(),t=v05Copy(locale);
 try{
  const {supabase}=await actionContext(true),id=uuid.safeParse(form.get("id"));
  if(!id.success || form.get("confirm")!=="on")return {error:t.error};
  const {error}=await supabase.from("non_school_days").delete().eq("id",id.data);if(error)return {error:t.error};
 }catch{return {error:t.error};}
 revalidatePath("/","layout");return {success:t.saved};
}
export async function restoreSchedule(_:ActionState,form:FormData):Promise<ActionState>{
 const {locale}=await getI18n(),t=v05Copy(locale);
 try{
  const {supabase}=await actionContext(true),id=uuid.safeParse(form.get("id")),active=uuid.safeParse(form.get("active"));
  if(!id.success || !active.success || form.get("confirm")!=="on")return {error:t.error};
  const {error}=await supabase.rpc("restore_schedule_version",{p_id:id.data,p_expected_active:active.data});
  if(error)return {error:t.error+" "+t.restoreHint};
 }catch{return {error:t.error};}
 revalidatePath("/","layout");return {success:t.saved};
}
