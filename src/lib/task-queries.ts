import "server-only";
import {database} from "./queries";
import {requireViewer} from "./auth";
import type {PersonalTask} from "./database.types";

export async function getPersonalTasks(limit=200):Promise<PersonalTask[]> {
 const {user}=await requireViewer("/");
 const supabase=await database();
 const {data,error}=await supabase.from("personal_tasks").select("*")
  .eq("owner_id",user.id).neq("status","archived")
  .order("status").order("due_at",{ascending:true,nullsFirst:false})
  .order("created_at",{ascending:false}).limit(Math.min(Math.max(limit,1),200));
 if(error){
  if(["42P01","PGRST205"].includes(error.code??""))return [];
  throw new Error("Не удалось загрузить задачи.");
 }
 return data;
}
