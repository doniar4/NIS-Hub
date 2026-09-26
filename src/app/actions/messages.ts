"use server";
import { actionContext } from "@/lib/auth";
import { uuid } from "@/lib/validation";
import type {
  AppNotification,
  DirectMessage,
  DmThread,
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
    const { data, error } = await supabase.rpc("dm_inbox_v053");
    return error ? failure(error) : { data };
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
