"use server";

import {revalidatePath} from "next/cache";
import {z} from "zod";
import {actionContext} from "@/lib/auth";
import type {PersonalTask,TaskStatus} from "@/lib/database.types";
import {uuid} from "@/lib/validation";

type TaskFailure={error:"invalid"|"migration"|"failed"|"rate"|"limit"|"unavailable"};
const iso=z.string().datetime({offset:true});
const nullableIso=z.union([iso,z.null()]);
const subtaskSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(120),
  completed: z.boolean(),
});
const saveSchema=z.object({
 id:z.union([uuid,z.null()]),title:z.string().trim().min(1).max(120),notes:z.string().trim().max(1000),
 priority:z.enum(["low","medium","high","urgent"]),subject:z.union([uuid,z.null()]),due:nullableIso,remind:nullableIso,
 subtasks: z.array(subtaskSchema).max(30).default([]),
}).strict().superRefine((value,ctx)=>{
 if(value.remind&&!value.due)ctx.addIssue({code:"custom",message:"reminder_needs_due",path:["remind"]});
 if(value.remind&&value.due&&Date.parse(value.remind)>Date.parse(value.due))ctx.addIssue({code:"custom",message:"reminder_after_due",path:["remind"]});
});

export type SaveTaskInput = z.infer<typeof saveSchema>;

function failure(error:{code?:string;message?:string}):TaskFailure {
 if(["42P01","42883","PGRST202","PGRST205"].includes(error.code??""))return {error:"migration"};
 if(error.message?.includes("rate_limit"))return {error:"rate"};
 if(error.message?.includes("task_limit"))return {error:"limit"};
 if(error.message?.includes("invalid_input"))return {error:"invalid"};
 if(error.message?.includes("unavailable"))return {error:"unavailable"};
 return {error:"failed"};
}
function refreshTasks(){revalidatePath("/");revalidatePath("/profile");}

export async function savePersonalTask(input:unknown):Promise<{data:PersonalTask}|TaskFailure>{
 const parsed=saveSchema.safeParse(input);if(!parsed.success)return {error:"invalid"};
 try{
  const {supabase,user}=await actionContext();const v=parsed.data;
  const {data:id,error}=await supabase.rpc("save_personal_task",{p_id:v.id,p_title:v.title,p_notes:v.notes,p_priority:v.priority,p_subject:v.subject,p_due:v.due,p_remind:v.remind,p_subtasks:v.subtasks});
  if(error)return failure(error);
  const row=await supabase.from("personal_tasks").select("*").eq("id",id).eq("owner_id",user.id).single();
  if(row.error)return failure(row.error);
  refreshTasks();return {data:row.data};
 }catch{return {error:"failed"};}
}

export async function toggleTaskSubtask(taskId:string,subtaskId:string,completed:boolean):Promise<{data:PersonalTask}|TaskFailure>{
 if(!uuid.safeParse(taskId).success||!subtaskId)return {error:"invalid"};
 try{
  const {supabase,user}=await actionContext();
  const {error}=await supabase.rpc("toggle_task_subtask",{p_task_id:taskId,p_subtask_id:subtaskId,p_completed:completed});
  if(error)return failure(error);
  const row=await supabase.from("personal_tasks").select("*").eq("id",taskId).eq("owner_id",user.id).single();
  if(row.error)return failure(row.error);
  refreshTasks();return {data:row.data};
 }catch{return {error:"failed"};}
}

export async function setPersonalTaskStatus(id:string,status:TaskStatus):Promise<{data:PersonalTask}|TaskFailure>{
 if(!uuid.safeParse(id).success||!["active","completed","archived"].includes(status))return {error:"invalid"};
 try{
  const {supabase,user}=await actionContext();
  const result=await supabase.rpc("set_personal_task_status",{p_id:id,p_status:status});if(result.error)return failure(result.error);
  const row=await supabase.from("personal_tasks").select("*").eq("id",id).eq("owner_id",user.id).single();if(row.error)return failure(row.error);
  refreshTasks();return {data:row.data};
 }catch{return {error:"failed"};}
}

export async function snoozePersonalTask(id:string,minutes:number):Promise<{data:PersonalTask}|TaskFailure>{
 if(!uuid.safeParse(id).success||![5,10,15,30,60,180,1440].includes(minutes))return {error:"invalid"};
 try{
  const {supabase,user}=await actionContext();
  const result=await supabase.rpc("snooze_personal_task",{p_id:id,p_minutes:minutes});if(result.error)return failure(result.error);
  const row=await supabase.from("personal_tasks").select("*").eq("id",id).eq("owner_id",user.id).single();if(row.error)return failure(row.error);
  refreshTasks();return {data:row.data};
 }catch{return {error:"failed"};}
}

export async function deletePersonalTask(id:string):Promise<{ok:true}|TaskFailure>{
 if(!uuid.safeParse(id).success)return {error:"invalid"};
 try{
  const {supabase,user}=await actionContext();
  const {error}=await supabase.from("personal_tasks").delete().eq("id",id).eq("owner_id",user.id);
  if(error)return failure(error);
  refreshTasks();return {ok:true};
 }catch{return {error:"failed"};}
}
