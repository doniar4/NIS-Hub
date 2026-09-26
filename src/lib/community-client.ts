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
export const loadNotifications = () => safe(actions.loadNotifications());
export const dismissNotification = (id: string,kind:"message"|"task"="message") =>
  safe(actions.dismissNotification(id,kind));
