"use server";
import { z } from "zod";
import { actionContext } from "@/lib/auth";
import { communityError, type CommunityError } from "@/lib/people";
import { revalidatePath } from "next/cache";
import type { ClassHomework } from "@/lib/database.types";
type Failure={error:CommunityError};
export async function loadHomework(date:string,offset=0):Promise<{data:ClassHomework[]}|Failure>{
 if(!z.iso.date().safeParse(date).success||!Number.isInteger(offset)||offset<0||offset>10000)return {error:"failed"};
 try{const {supabase,user}=await actionContext();const profile=await supabase.from("profiles").select("class_id").eq("id",user.id).single();if(profile.error)return {error:"failed"};if(!profile.data.class_id)return {data:[]};
 const {data,error}=await supabase.from("class_homework").select("*").eq("class_id",profile.data.class_id).eq("due_date",date).eq("moderation_status","visible").is("deleted_at",null).order("created_at").order("id").range(offset,offset+19);return error?communityError(error):{data};
 }catch{return {error:"failed"};}
}
export async function saveHomework(input:unknown):Promise<{ok:true}|Failure>{
 const parsed=z.object({id:z.uuid().nullable(),subject:z.uuid(),date:z.iso.date(),body:z.string().trim().min(1).max(1000)}).strict().safeParse(input);
 if(!parsed.success)return {error:"failed"};
 try{const {supabase}=await actionContext(),v=parsed.data;const {error}=await supabase.rpc("save_class_homework",{p_id:v.id,p_subject:v.subject,p_due:v.date,p_body:v.body});if(error)return communityError(error);revalidatePath("/schedule");return {ok:true};}catch{return {error:"failed"};}
}
export async function deleteHomework(id:string):Promise<{ok:true}|Failure>{
 if(!z.uuid().safeParse(id).success)return {error:"failed"};
 try{const {supabase}=await actionContext();const {error}=await supabase.rpc("delete_class_homework",{p_id:id});return error?communityError(error):{ok:true};}catch{return {error:"failed"};}
}
export async function moderateHomework(id:string):Promise<{ok:true}|Failure>{
 if(!z.uuid().safeParse(id).success)return {error:"failed"};
 try{const {supabase}=await actionContext(true);const {error}=await supabase.rpc("moderate_class_homework",{p_id:id});if(error)return communityError(error);revalidatePath("/schedule");return {ok:true};}catch{return {error:"failed"};}
}
export async function loadReportContext(id:string):Promise<{data:string|null}|Failure>{
 if(!z.uuid().safeParse(id).success)return {error:"failed"};
 try{const {supabase}=await actionContext(true);const {data,error}=await supabase.rpc("community_report_context",{p_id:id});return error?communityError(error):{data};}catch{return {error:"failed"};}
}
