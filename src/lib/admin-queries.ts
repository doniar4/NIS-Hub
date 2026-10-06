import "server-only";
import {cache} from "react";
import {requireAdmin} from "./auth";
import {database} from "./queries";
import {coarseAgent,activityLabel} from "./admin-control";
import type {AdminDataKey,AdminDataMap,AdminUser,AdminEvent} from "./admin-types";
import type {Locale} from "./i18n";

// React.cache only deduplicates within this RSC request. No cross-user/shared
// public cache, service-role client, or module-level mutable data store.
const read=cache(async(section:AdminDataKey,filters:string)=>{
 await requireAdmin();
 try{const db=await database();
  const {data,error}=await db.rpc("admin_control_read",{p_section:section,p_filters:JSON.parse(filters)}).abortSignal(AbortSignal.timeout(10000));
  return error?null:data;
 }catch{return null;}
});
export async function adminData<K extends AdminDataKey>(section:K,filters:Record<string,string|number|undefined>={},locale:Locale="ru"):Promise<AdminDataMap[K]|null>{
 const raw=await read(section,JSON.stringify(filters));if(raw===null)return null;
 // Do not serialize the raw user-agent or raw tracker path to client props.
 if(section==="users"){
  const data=raw as unknown as {total:number;rows:(Omit<AdminUser,"device"|"browser">&{user_agent:string|null})[]};
  return {total:data.total,rows:data.rows.map(({user_agent,...row})=>({...row,...coarseAgent(user_agent)}))} as AdminDataMap[K];
 }
 if(section==="feed")return (raw as unknown as (Omit<AdminEvent,"action"|"device"|"browser">&{path:string;user_agent:string|null})[]).map(({path,user_agent,...row})=>({...row,action:activityLabel(path,locale),...coarseAgent(user_agent)})) as AdminDataMap[K];
 return raw as unknown as AdminDataMap[K];
}
