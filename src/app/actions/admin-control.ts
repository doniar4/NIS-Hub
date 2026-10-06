"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {actionContext} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {controlCopy,adminTime} from "@/lib/admin-control";
import type {ActionState} from "@/lib/action-state";
import type {ChartPoint} from "@/lib/admin-types";
import {moderateHomework} from "./homework";
export async function updateAdminUser(_state:ActionState,form:FormData):Promise<ActionState>{
 const {locale}=await getI18n(),t=controlCopy(locale);
 const parsed=z.object({id:z.uuid(),class:z.uuid().nullable(),role:z.enum(["student","admin"]),expected:z.enum(["student","admin"]),confirm:z.literal("on")}).safeParse({id:form.get("id"),class:form.get("class")||null,role:form.get("role"),expected:form.get("expected"),confirm:form.get("confirm")});
 if(!parsed.success)return {error:t.confirmUser};
 try{const {supabase}=await actionContext(true),v=parsed.data;
  const {error}=await supabase.rpc("admin_update_user",{p_user:v.id,p_class:v.class,p_role:v.role,p_expected_role:v.expected,p_confirm:true});
  if(error)return {error:error.message==="last_admin"?t.lastAdmin:error.message==="stale"?t.stale:t.unavailable};
  revalidatePath("/admin","layout");return {success:t.saved};
 }catch{return {error:t.unavailable};}
}
export async function hideAdminHomework(_state:ActionState,form:FormData):Promise<ActionState>{
 const {locale}=await getI18n(),t=controlCopy(locale);
 if(!z.uuid().safeParse(form.get("id")).success||form.get("confirm")!=="on")return {error:t.confirmHide};
 // Reuse the existing admin-only RPC/action. No direct table mutation and no
 // alternate permission model. It hides rather than toggles, so retries are safe.
 const result=await moderateHomework(String(form.get("id")));
 if("error" in result)return {error:t.unavailable};
 revalidatePath("/admin/homework");return {success:t.saved};
}
export async function loadAdminChart(range:unknown):Promise<{data:ChartPoint[]}|{error:true}>{
 const parsed=z.enum(["24h","7d","30d"]).safeParse(range);if(!parsed.success)return {error:true};
 try{const {supabase}=await actionContext(true),{locale}=await getI18n();const {data,error}=await supabase.rpc("admin_control_read",{p_section:"chart",p_filters:{range:parsed.data}});return error?{error:true}:{data:(data as unknown as ChartPoint[]).map(p=>({...p,label:adminTime(p.at,locale)}))};}catch{return {error:true};}
}
