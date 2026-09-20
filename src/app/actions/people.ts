"use server";
import { z } from "zod";
import { actionContext } from "@/lib/auth";
import { communityError, type Person, type PeopleScope, type CommunityError } from "@/lib/people";
type Failure={error:CommunityError};
export async function findPeople(scope:PeopleScope,query="",id?:string,offset=0):Promise<{data:Person[]}|Failure>{
 const parsed=z.object({scope:z.enum(["search","profile","friends","requests","blocked"]),query:z.string().max(60),id:z.uuid().optional(),offset:z.number().int().min(0).max(10000)}).safeParse({scope,query,id,offset});
 if(!parsed.success)return {error:"failed"};
 try {const {supabase}=await actionContext();const {data,error}=await supabase.rpc("people_list",{p_scope:scope,p_query:query,p_id:id??null,p_offset:offset});return error?communityError(error):{data};}catch{return {error:"failed"};}
}
export async function changeFriend(peer:string,action:"request"|"accept"|"remove"):Promise<{ok:true}|Failure>{
 if(!z.uuid().safeParse(peer).success||!["request","accept","remove"].includes(action))return {error:"failed"};
 try {const {supabase}=await actionContext();const {error}=await supabase.rpc("friend_action",{p_peer:peer,p_action:action});return error?communityError(error):{ok:true};}catch{return {error:"failed"};}
}
