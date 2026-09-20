"use server";
import { z } from "zod";
import { actionContext } from "@/lib/auth";
import { communityError, type CommunityError } from "@/lib/people";
import { revalidatePath } from "next/cache";
export async function safetyAction(input:unknown):Promise<{ok:true}|{error:CommunityError}>{
 const parsed=z.discriminatedUnion("action",[
 z.object({action:z.enum(["block","unblock","hide","delete","resolve"]),id:z.uuid()}).strict(),
 z.object({action:z.literal("report"),id:z.uuid(),kind:z.enum(["profile","message","homework"]),reason:z.enum(["spam","harassment","privacy","other"]),detail:z.string().trim().max(500)}).strict()
 ]).safeParse(input);
 if(!parsed.success)return {error:"failed"};
 try{
 const v=parsed.data,{supabase}=await actionContext(v.action==="resolve");
 const result=v.action==="block"||v.action==="unblock"?await supabase.rpc("set_user_block",{p_peer:v.id,p_blocked:v.action==="block"}):
 v.action==="hide"?await supabase.rpc("set_dm_hidden",{p_thread:v.id,p_hidden:true}):
 v.action==="delete"?await supabase.rpc("delete_own_dm",{p_message:v.id}):
 v.action==="report"?await supabase.rpc("report_community",{p_kind:v.kind,p_target:v.id,p_reason:v.reason,p_detail:v.detail}):
 await supabase.rpc("resolve_community_report",{p_id:v.id});
 if(result.error)return communityError(result.error);
 for(const path of ["/people","/friends","/messages","/admin/community"])revalidatePath(path);
 return {ok:true};
 }catch{return {error:"failed"};}
}
