"use client";
import * as actions from "@/app/actions/messages";
async function safe<T>(request: Promise<T>): Promise<T | { error: "failed" }> {
  try {
    return await request;
  } catch {
    return { error: "failed" };
  }
}
export const loadInbox = () => safe(actions.loadInbox());
export const startConversation = (name: string) =>
  safe(actions.startConversation(name));
export const loadMessages = (
  thread: string,
  before?: { at: string; id: string },
) => safe(actions.loadMessages(thread, before));
export const sendMessage = (thread: string, body: string, client: string) =>
  safe(actions.sendMessage(thread, body, client));
export const markConversationRead = (thread: string, message: string) =>
  safe(actions.markConversationRead(thread, message));
export const loadStudyGroups=()=>safe(actions.loadStudyGroups());
export const createStudyGroup=(input:{name:string;subject:string;description:string;members:string[];avatarIcon:number;avatarColor:number})=>safe(actions.createStudyGroup(input));
export const loadStudyGroupMessages=(group:string,before?:{at:string;id:string},query="")=>safe(actions.loadStudyGroupMessages(group,before,query));
export const sendStudyGroupMessage=(group:string,body:string,client:string,reply?:string|null)=>safe(actions.sendStudyGroupMessage(group,body,client,reply));
export const loadStudyGroupInvites=()=>safe(actions.loadStudyGroupInvites());
export const respondStudyGroupInvite=(invite:string,accept:boolean)=>safe(actions.respondStudyGroupInvite(invite,accept));
export const joinStudyGroupCode=(code:string)=>safe(actions.joinStudyGroupCode(code));
export const loadStudyGroupFriends=(group:string)=>safe(actions.loadStudyGroupFriends(group));
export const searchStudyGroupPeople=(group:string,query:string)=>safe(actions.searchStudyGroupPeople(group,query));
export const inviteStudyGroupMembers=(group:string,users:string[])=>safe(actions.inviteStudyGroupMembers(group,users));
export const loadStudyGroupMembers=(group:string)=>safe(actions.loadStudyGroupMembers(group));
export const loadStudyGroupAudit=(group:string)=>safe(actions.loadStudyGroupAudit(group));
export const createStudyGroupCode=(group:string,hours:number,maxUses:number)=>safe(actions.createStudyGroupCode(group,hours,maxUses));
export const revokeStudyGroupCode=(group:string)=>safe(actions.revokeStudyGroupCode(group));
export const updateStudyGroup=(input:Parameters<typeof actions.updateStudyGroup>[0])=>safe(actions.updateStudyGroup(input));
export const setStudyGroupMemberRole=(group:string,user:string,role:"admin"|"member")=>safe(actions.setStudyGroupMemberRole(group,user,role));
export const removeStudyGroupMember=(group:string,user:string)=>safe(actions.removeStudyGroupMember(group,user));
export const setStudyGroupMuted=(group:string,muted:boolean)=>safe(actions.setStudyGroupMuted(group,muted));
export const leaveStudyGroup=(group:string)=>safe(actions.leaveStudyGroup(group));
export const deleteStudyGroup=(group:string)=>safe(actions.deleteStudyGroup(group));
export const readStudyGroup=(group:string)=>safe(actions.readStudyGroup(group));
export const deleteStudyGroupMessage=(message:string)=>safe(actions.deleteStudyGroupMessage(message));
export const toggleStudyGroupReaction=(message:string,emoji:number)=>safe(actions.toggleStudyGroupReaction(message,emoji));
export const pinStudyGroupMessage=(group:string,message:string|null)=>safe(actions.pinStudyGroupMessage(group,message));
export const loadNotifications = () => safe(actions.loadNotifications());
export const dismissNotification = (id: string,kind:"message"|"task"="message") =>
  safe(actions.dismissNotification(id,kind));
