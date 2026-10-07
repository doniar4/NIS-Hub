"use server";
import { actionContext } from "@/lib/auth";
import { uuid } from "@/lib/validation";
import { withMessageAvatars } from "@/lib/message-avatars";
import type {
  AppNotification,
  DirectMessage,
  DmThread,
  StudyGroup,
  StudyGroupAudit,
  StudyGroupInvite,
  StudyGroupMember,
  StudyGroupMessage,
  StudyGroupPerson,
  TaskReminder,
  WebNotification,
} from "@/lib/database.types";
type Failure = {
  error: "migration" | "failed" | "unavailable" | "nameRequired" | "rate";
};
function failure(error: { code?: string; message?: string }): Failure {
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code ?? ""))
    return { error: "migration" };
  if (error.message?.includes("recipient_unavailable"))
    return { error: "unavailable" };
  if (error.message?.includes("name_required"))
    return { error: "nameRequired" };
  if (error.message?.includes("rate_limit")) return { error: "rate" };
  return { error: "failed" };
}
export async function loadInbox(): Promise<{ data: DmThread[] } | Failure> {
  try {
    const { supabase } = await actionContext();
    const { data, error } = await supabase.rpc("dm_inbox_v2");
    return error ? failure(error) : { data: await withMessageAvatars(data ?? [],
      (paths, ttl) => supabase.storage.from("avatars").createSignedUrls(paths, ttl)) };
  } catch {
    return { error: "failed" };
  }
}
export async function startConversation(
  name: string,
): Promise<{ id: string } | Failure> {
  if (typeof name !== "string" || !name.trim() || name.length > 60)
    return { error: "unavailable" };
  try {
    const { supabase } = await actionContext();
    const { data, error } = await supabase.rpc("start_dm", {
      p_name: name.trim(),
    });
    return error ? failure(error) : { id: data };
  } catch {
    return { error: "failed" };
  }
}
export async function loadMessages(
  thread: string,
  before?: { at: string; id: string },
): Promise<{ data: DirectMessage[]; more: boolean } | Failure> {
  if (
    !uuid.safeParse(thread).success ||
    (before &&
      (!uuid.safeParse(before.id).success ||
        !/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(before.at)))
  )
    return { error: "failed" };
  try {
    const { supabase } = await actionContext();
    const { data, error } = await supabase.rpc("dm_history_v053", {p_thread:thread,p_before:before?.at??null,p_id:before?.id??null});
    return error
      ? failure(error)
      : { data: data.slice(0, 50).reverse(), more: data.length > 50 };
  } catch {
    return { error: "failed" };
  }
}
export async function sendMessage(
  thread: string,
  body: string,
  client: string,
): Promise<{ id: string } | Failure> {
  if (
    !uuid.safeParse(thread).success ||
    !uuid.safeParse(client).success ||
    typeof body !== "string" ||
    !body.trim() ||
    body.trim().length > 2000
  )
    return { error: "failed" };
  try {
    const { supabase } = await actionContext();
    const { data, error } = await supabase.rpc("send_dm", {
      p_thread: thread,
      p_body: body.trim(),
      p_client: client,
    });
    return error ? failure(error) : { id: data };
  } catch {
    return { error: "failed" };
  }
}
export async function markConversationRead(
  thread: string,
  message: string,
): Promise<{ ok: true } | Failure> {
  if (!uuid.safeParse(thread).success || !uuid.safeParse(message).success)
    return { error: "failed" };
  try {
    const { supabase } = await actionContext();
    const { error } = await supabase.rpc("read_dm", {
      p_thread: thread,
      p_message: message,
    });
    return error ? failure(error) : { ok: true };
  } catch {
    return { error: "failed" };
  }
}
export async function loadStudyGroups(): Promise<{data:StudyGroup[]}|Failure> {
  try {
    const {supabase}=await actionContext();
    const {data,error}=await supabase.rpc("study_group_inbox");
    return error?failure(error):{data};
  } catch { return {error:"failed"}; }
}
export async function createStudyGroup(input:{name:string;subject:string;description:string;members:string[];avatarIcon:number;avatarColor:number}):Promise<{id:string}|Failure> {
  if(!input||typeof input.name!=="string"||!input.name.trim()||input.name.trim().length>80||typeof input.subject!=="string"||!input.subject.trim()||input.subject.trim().length>80||typeof input.description!=="string"||input.description.length>500||!Array.isArray(input.members)||input.members.length>30||input.members.some(name=>typeof name!=="string"||name.length>60)||!Number.isInteger(input.avatarIcon)||input.avatarIcon<0||input.avatarIcon>11||!Number.isInteger(input.avatarColor)||input.avatarColor<0||input.avatarColor>7)return {error:"failed"};
  try {
    const {supabase}=await actionContext();
    const {data,error}=await supabase.rpc("create_study_group",{p_name:input.name.trim(),p_subject:input.subject.trim(),p_description:input.description.trim(),p_members:input.members.map(name=>name.trim()).filter(Boolean),p_avatar_icon:input.avatarIcon,p_avatar_color:input.avatarColor});
    return error?failure(error):{id:data};
  } catch { return {error:"failed"}; }
}
export async function loadStudyGroupMessages(group:string,before?:{at:string;id:string},query=""):Promise<{data:StudyGroupMessage[];more:boolean}|Failure> {
  if(!uuid.safeParse(group).success||typeof query!=="string"||query.length>100||(before&&(!uuid.safeParse(before.id).success||!/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(before.at))))return {error:"failed"};
  try {
    const {supabase}=await actionContext();
    const {data,error}=await supabase.rpc("study_group_history",{p_group:group,p_before:before?.at??null,p_id:before?.id??null,p_query:query.trim()});
    return error?failure(error):{data:data.slice(0,50).reverse(),more:data.length>50};
  } catch { return {error:"failed"}; }
}
export async function sendStudyGroupMessage(group:string,body:string,client:string,reply?:string|null):Promise<{id:string}|Failure> {
  if(!uuid.safeParse(group).success||!uuid.safeParse(client).success||(reply&&!uuid.safeParse(reply).success)||typeof body!=="string"||!body.trim()||body.trim().length>2000)return {error:"failed"};
  try {
    const {supabase}=await actionContext();
    const {data,error}=await supabase.rpc("send_study_group_message",{p_group:group,p_body:body.trim(),p_client:client,p_reply:reply??null});
    return error?failure(error):{id:data};
  } catch { return {error:"failed"}; }
}
export async function loadStudyGroupInvites():Promise<{data:StudyGroupInvite[]}|Failure>{try{const{supabase}=await actionContext();const{data,error}=await supabase.rpc("study_group_invitation_inbox");return error?failure(error):{data};}catch{return{error:"failed"};}}
export async function respondStudyGroupInvite(invite:string,accept:boolean):Promise<{id:string}|Failure>{if(!uuid.safeParse(invite).success||typeof accept!=="boolean")return{error:"failed"};try{const{supabase}=await actionContext();const{data,error}=await supabase.rpc("respond_study_group_invite",{p_invite:invite,p_accept:accept});return error?failure(error):{id:data};}catch{return{error:"failed"};}}
export async function joinStudyGroupCode(code:string):Promise<{id:string}|Failure>{if(typeof code!=="string"||!/^[A-Z2-9]{8}$/i.test(code.trim()))return{error:"failed"};try{const{supabase}=await actionContext();const{data,error}=await supabase.rpc("join_study_group_code",{p_code:code.trim().toUpperCase()});return error?failure(error):{id:data};}catch{return{error:"failed"};}}
export async function loadStudyGroupFriends(group:string):Promise<{data:StudyGroupPerson[]}|Failure>{if(!uuid.safeParse(group).success)return{error:"failed"};try{const{supabase}=await actionContext();const{data,error}=await supabase.rpc("study_group_friends",{p_group:group});return error?failure(error):{data};}catch{return{error:"failed"};}}
export async function searchStudyGroupPeople(group:string,query:string):Promise<{data:StudyGroupPerson[]}|Failure>{if(!uuid.safeParse(group).success||typeof query!=="string"||query.trim().length<2||query.trim().length>60)return{error:"failed"};try{const{supabase}=await actionContext();const{data,error}=await supabase.rpc("study_group_people",{p_group:group,p_query:query.trim()});return error?failure(error):{data};}catch{return{error:"failed"};}}
export async function inviteStudyGroupMembers(group:string,users:string[]):Promise<{count:number}|Failure>{if(!uuid.safeParse(group).success||!Array.isArray(users)||users.length>30||users.some(id=>!uuid.safeParse(id).success))return{error:"failed"};try{const{supabase}=await actionContext();const{data,error}=await supabase.rpc("invite_study_group_members",{p_group:group,p_users:[...new Set(users)]});return error?failure(error):{count:data};}catch{return{error:"failed"};}}
export async function loadStudyGroupMembers(group:string):Promise<{data:StudyGroupMember[]}|Failure>{if(!uuid.safeParse(group).success)return{error:"failed"};try{const{supabase}=await actionContext();const{data,error}=await supabase.rpc("study_group_member_list",{p_group:group});return error?failure(error):{data};}catch{return{error:"failed"};}}
export async function loadStudyGroupAudit(group:string):Promise<{data:StudyGroupAudit[]}|Failure>{if(!uuid.safeParse(group).success)return{error:"failed"};try{const{supabase}=await actionContext();const{data,error}=await supabase.rpc("study_group_audit_list",{p_group:group});return error?failure(error):{data};}catch{return{error:"failed"};}}
export async function createStudyGroupCode(group:string,hours:number,maxUses:number):Promise<{code:string}|Failure>{if(!uuid.safeParse(group).success||!Number.isInteger(hours)||hours<1||hours>168||!Number.isInteger(maxUses)||maxUses<1||maxUses>100)return{error:"failed"};try{const{supabase}=await actionContext();const{data,error}=await supabase.rpc("create_study_group_code",{p_group:group,p_hours:hours,p_max_uses:maxUses});return error?failure(error):{code:data};}catch{return{error:"failed"};}}
export async function revokeStudyGroupCode(group:string):Promise<{ok:true}|Failure>{return groupVoid(group,"revoke_study_group_code");}
export async function updateStudyGroup(input:{group:string;name:string;subject:string;description:string;icon:number;color:number;adminsOnly:boolean;membersInvite:boolean}):Promise<{ok:true}|Failure>{if(!uuid.safeParse(input?.group).success||typeof input.name!=="string"||!input.name.trim()||input.name.trim().length>80||typeof input.subject!=="string"||!input.subject.trim()||input.subject.trim().length>80||typeof input.description!=="string"||input.description.length>500||!Number.isInteger(input.icon)||input.icon<0||input.icon>11||!Number.isInteger(input.color)||input.color<0||input.color>7)return{error:"failed"};try{const{supabase}=await actionContext();const{error}=await supabase.rpc("update_study_group",{p_group:input.group,p_name:input.name.trim(),p_subject:input.subject.trim(),p_description:input.description.trim(),p_icon:input.icon,p_color:input.color,p_admins_only:input.adminsOnly,p_members_invite:input.membersInvite});return error?failure(error):{ok:true};}catch{return{error:"failed"};}}
export async function setStudyGroupMemberRole(group:string,user:string,role:"admin"|"member"):Promise<{ok:true}|Failure>{if(!uuid.safeParse(group).success||!uuid.safeParse(user).success||!(["admin","member"] as const).includes(role))return{error:"failed"};try{const{supabase}=await actionContext();const{error}=await supabase.rpc("set_study_group_member_role",{p_group:group,p_user:user,p_role:role});return error?failure(error):{ok:true};}catch{return{error:"failed"};}}
export async function removeStudyGroupMember(group:string,user:string):Promise<{ok:true}|Failure>{if(!uuid.safeParse(group).success||!uuid.safeParse(user).success)return{error:"failed"};try{const{supabase}=await actionContext();const{error}=await supabase.rpc("remove_study_group_member",{p_group:group,p_user:user});return error?failure(error):{ok:true};}catch{return{error:"failed"};}}
async function groupVoid(group:string,fn:"revoke_study_group_code"|"leave_study_group"|"delete_study_group"|"read_study_group",extra:Record<string,never>={}):Promise<{ok:true}|Failure>{if(!uuid.safeParse(group).success)return{error:"failed"};try{const{supabase}=await actionContext();const{error}=await supabase.rpc(fn,{p_group:group,...extra});return error?failure(error):{ok:true};}catch{return{error:"failed"};}}
export async function setStudyGroupMuted(group:string,muted:boolean):Promise<{ok:true}|Failure>{if(!uuid.safeParse(group).success||typeof muted!=="boolean")return{error:"failed"};try{const{supabase}=await actionContext();const{error}=await supabase.rpc("set_study_group_preferences",{p_group:group,p_muted:muted});return error?failure(error):{ok:true};}catch{return{error:"failed"};}}
export async function leaveStudyGroup(group:string){return groupVoid(group,"leave_study_group");}
export async function deleteStudyGroup(group:string){return groupVoid(group,"delete_study_group");}
export async function readStudyGroup(group:string){return groupVoid(group,"read_study_group");}
export async function deleteStudyGroupMessage(message:string):Promise<{ok:true}|Failure>{if(!uuid.safeParse(message).success)return{error:"failed"};try{const{supabase}=await actionContext();const{error}=await supabase.rpc("delete_study_group_message",{p_message:message});return error?failure(error):{ok:true};}catch{return{error:"failed"};}}
export async function toggleStudyGroupReaction(message:string,emoji:number):Promise<{active:boolean}|Failure>{if(!uuid.safeParse(message).success||!Number.isInteger(emoji)||emoji<0||emoji>7)return{error:"failed"};try{const{supabase}=await actionContext();const{data,error}=await supabase.rpc("toggle_study_group_reaction",{p_message:message,p_emoji:emoji});return error?failure(error):{active:data};}catch{return{error:"failed"};}}
export async function pinStudyGroupMessage(group:string,message:string|null):Promise<{ok:true}|Failure>{if(!uuid.safeParse(group).success||(message!==null&&!uuid.safeParse(message).success))return{error:"failed"};try{const{supabase}=await actionContext();const{error}=await supabase.rpc("pin_study_group_message",{p_group:group,p_message:message});return error?failure(error):{ok:true};}catch{return{error:"failed"};}}
export async function loadNotifications(): Promise<
  { data: AppNotification[]; unread: number } | Failure
> {
  try {
    const { supabase } = await actionContext();
    const [feed, count, taskFeed, taskCount] = await Promise.all([
      supabase.rpc("notification_feed_v053"),
      supabase.rpc("notification_unread_v053"),
      supabase.rpc("task_notification_feed"),
      supabase.rpc("task_notification_unread"),
    ]);
    const taskMigrationMissing=["42883","PGRST202"].includes(taskFeed.error?.code??"")||["42883","PGRST202"].includes(taskCount.error?.code??"");
    const messages:AppNotification[]=(feed.data??[]).map((item:WebNotification)=>({id:item.id,kind:"message",href:`/messages?thread=${item.thread_id}`,title:item.actor_name,body_preview:item.body_preview,created_at:item.created_at,read_at:item.read_at,thread_id:item.thread_id}));
    const tasks:AppNotification[]=taskMigrationMissing?[]:((taskFeed.data??[]) as TaskReminder[]).map(item=>({id:item.id,kind:"task",href:"/profile#tasks",title:item.title,body_preview:"",created_at:item.remind_at,read_at:item.read_at,task_id:item.task_id,priority:item.priority,due_at:item.due_at}));
    return feed.error
      ? failure(feed.error)
      : count.error
        ? failure(count.error)
        : !taskMigrationMissing&&taskFeed.error
          ? failure(taskFeed.error)
          : !taskMigrationMissing&&taskCount.error
            ? failure(taskCount.error)
            : { data: [...messages,...tasks].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,30), unread: (count.data ?? 0)+(taskMigrationMissing?0:(taskCount.data??0)) };
  } catch {
    return { error: "failed" };
  }
}
export async function dismissNotification(
  id: string,kind:"message"|"task"="message",
): Promise<{ ok: true } | Failure> {
  if (!uuid.safeParse(id).success) return { error: "failed" };
  try {
    const { supabase } = await actionContext();
    const { error } = kind==="task"?await supabase.rpc("dismiss_task_notification",{p_id:id}):await supabase.rpc("dismiss_notification", { p_id: id });
    return error ? failure(error) : { ok: true };
  } catch {
    return { error: "failed" };
  }
}
