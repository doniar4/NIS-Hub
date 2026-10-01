"use client";
import Link from "next/link";
import { messagePreview } from "@/lib/people";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BellIcon,
  ChatBubbleIcon,
  Cross2Icon,
  CheckIcon,
} from "@radix-ui/react-icons";
import {CalendarCheck2,Clock3} from "lucide-react";
import { loadNotifications, dismissNotification } from "@/lib/community-client";
import {snoozePersonalTask} from "@/app/actions/tasks";
import type { AppNotification } from "@/lib/database.types";
import {SMS_NOTICE_CACHE_KEY,parseSmsResultNotices,type SmsResultNotice} from "@/lib/sms/recent";
import { communityCopy } from "@/lib/community-copy";
import {tasksCopy} from "@/lib/tasks-copy";
import { useI18n } from "./locale-provider";
export function NotificationCenter() {
  type NotificationItem=AppNotification|SmsResultNotice;
  const { locale } = useI18n(),
    p = communityCopy(locale),tasks=tasksCopy(locale);
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<NotificationItem[]>([]),
    [unread, setUnread] = useState(0),
    [toasts, setToasts] = useState<NotificationItem[]>([]),
    [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    seen = useRef<Set<string> | null>(null);
  const refresh = useCallback(async () => {
    const sms=parseSmsResultNotices(localStorage.getItem(SMS_NOTICE_CACHE_KEY));
    const result = await loadNotifications();
    if ("error" in result) {
      setError(p[result.error]);
      setItems(sms);
      setUnread(sms.filter(item=>!item.read_at).length);
      return;
    }
    const combined:NotificationItem[]=[...result.data,...sms].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,30);
    setItems(combined);
    setUnread(result.unread+sms.filter(item=>!item.read_at).length);
    setError("");
    const previous = seen.current;
    seen.current = new Set(combined.map((n) => n.id));
    let notified=new Set<string>();
    try{notified=new Set<string>(JSON.parse(localStorage.getItem("nis-task-notified")??"[]"));}catch{}
    let smsNotified=new Set<string>();
    try{smsNotified=new Set<string>(JSON.parse(localStorage.getItem("nis-sms-notified")??"[]"));}catch{}
    const fresh = combined.filter((n) => !n.read_at&&(previous?!previous.has(n.id):n.kind==="task"?!notified.has(`${n.id}:${n.created_at}`):n.kind==="sms"&&!smsNotified.has(n.id)));
    if (previous||fresh.length) {
      const readIds = new Set(result.data.filter(n => n.read_at).map(n => n.id));
      setToasts((old) =>
          Array.from(
            new Map([...old.filter(n => !readIds.has(n.id) && combined.some(current=>current.id===n.id)).map(n=>combined.find(current=>current.id===n.id)??n), ...fresh].map((n) => [n.id, n])).values(),
          ).slice(-3),
        );
      if("Notification" in window&&Notification.permission==="granted"&&localStorage.getItem("nis-task-browser-notifications")!=="disabled"&&document.hidden){
        for(const notice of fresh.filter(n=>n.kind==="task"))if(!notified.has(`${notice.id}:${notice.created_at}`)){
          const systemNotice=new Notification(tasks.reminderLabel,{body:notice.title,icon:"/icon.svg",tag:`task-${notice.id}`});
          systemNotice.onclick=()=>{window.focus();window.location.assign(notice.href);systemNotice.close();};
          notified.add(`${notice.id}:${notice.created_at}`);
        }
        localStorage.setItem("nis-task-notified",JSON.stringify([...notified].slice(-100)));
      }
      if("Notification" in window&&Notification.permission==="granted"&&localStorage.getItem("nis-sms-browser-notifications")!=="disabled"&&document.hidden){
        for(const notice of fresh.filter((n):n is SmsResultNotice=>n.kind==="sms")){
          const systemNotice=new Notification(notice.title,{body:notice.body_preview,icon:"/icon.svg",tag:notice.id});
          systemNotice.onclick=()=>{window.focus();window.location.assign(notice.href);systemNotice.close();};
        }
      }
      for(const notice of fresh)if(notice.kind==="sms")smsNotified.add(notice.id);
      if(fresh.some(notice=>notice.kind==="sms"))localStorage.setItem("nis-sms-notified",JSON.stringify([...smsNotified].slice(-100)));
    }
  }, [p,tasks]);
  useEffect(() => {
    let alive = true,
      busy = false;
    const poll = async () => {
      const backgroundReminders="Notification" in window&&Notification.permission==="granted"&&(localStorage.getItem("nis-task-browser-notifications")!=="disabled"||localStorage.getItem("nis-sms-browser-notifications")!=="disabled");
      if (busy || !alive || (document.hidden&&!backgroundReminders)) return;
      busy = true;
      try {
        await refresh();
      } finally {
        busy = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 15000);
    window.addEventListener("nis-notifications-change", poll);
    window.addEventListener("nis-sms-results",poll);
    document.addEventListener("visibilitychange", poll);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("nis-notifications-change", poll);
      window.removeEventListener("nis-sms-results",poll);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const dismiss = async (id: string,kind:"message"|"task"|"sms") => {
    if(kind==="sms") {
      const now=new Date().toISOString();
      try {localStorage.setItem(SMS_NOTICE_CACHE_KEY,JSON.stringify(parseSmsResultNotices(localStorage.getItem(SMS_NOTICE_CACHE_KEY)).map(item=>item.id===id?{...item,read_at:now}:item)));}catch{}
      setItems(old=>old.map(item=>item.id===id?{...item,read_at:now}:item));
      setToasts(old=>old.filter(item=>item.id!==id));
      setUnread(value=>Math.max(0,value-1));
      return;
    }
    const result = await dismissNotification(id,kind);
    if ("error" in result) {
      setError(p[result.error]);
      return;
    }
    setToasts((old) => old.filter((n) => n.id !== id));
    await refresh();
  };
  const snooze=async(id:string)=>{
    const result=await snoozePersonalTask(id,10);
    if("error" in result){setError(tasks.failed);return;}
    setToasts(old=>old.filter(item=>item.id!==id));await refresh();
  };
  return (
    <div className="notification-center" ref={root}>
      <button
        type="button"
        className="notification-trigger"
        ref={button}
        aria-label={`${p.notifications}${unread ? `: ${unread}` : ""}`}
        aria-expanded={open}
        aria-controls="notification-list"
        onClick={() => {
          setOpen((v) => !v);
          void refresh();
        }}
      >
        <BellIcon aria-hidden="true" />
        {unread > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <section
          id="notification-list"
          className="notification-popover surface-card"
          aria-label={p.notifications}
        >
          <h2 className="section-title">{p.notifications}</h2>
          <p className="notification-hint">{p.webOnly}</p>
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : !items.length ? (
            <p className="py-4 text-sm">{p.noNotifications}</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`notification-card ${n.read_at ? "notification-read" : ""}`}
                >
                  <span className="notification-icon">
                    {n.kind==="task"?<CalendarCheck2 aria-hidden="true"/>:n.kind==="sms"?<BellIcon aria-hidden="true"/>:<ChatBubbleIcon aria-hidden="true" />}
                  </span>
                  <Link
                    href={n.href}
                    onClick={() => {
                      setOpen(false);
                      void dismiss(n.id,n.kind);
                    }}
                    className="notification-copy"
                  >
                    <strong>{n.kind==="task"?tasks.reminderLabel:n.title}</strong>
                    <span className="preview-lines">{n.kind==="task"?n.title:n.kind==="sms"?n.body_preview:messagePreview(n.body_preview ?? "")}</span>
                    <time dateTime={n.created_at}>
                      {new Intl.DateTimeFormat(locale, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(n.created_at))}
                    </time>
                  </Link>
                  {!n.read_at && (
                    <div className="notification-actions">{n.kind==="task"&&<button className="notification-dismiss" aria-label={`${tasks.snooze}: ${n.title}`} title={tasks.snooze} onClick={()=>void snooze(n.id)}><Clock3 aria-hidden="true"/></button>}<button className="notification-dismiss" aria-label={`${p.markRead}: ${n.title}`} onClick={() => void dismiss(n.id,n.kind)}><CheckIcon aria-hidden="true" /></button></div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div
        className="notification-toasts"
        aria-live="polite"
        aria-relevant="additions"
      >
        <ul>
          {toasts.map((n) => (
            <li key={n.id} className="notification-card">
              <span className="notification-icon">
                {n.kind==="task"?<CalendarCheck2 aria-hidden="true"/>:n.kind==="sms"?<BellIcon aria-hidden="true"/>:<ChatBubbleIcon aria-hidden="true" />}
              </span>
              <Link
                className="notification-copy"
                href={n.href}
                onClick={() => void dismiss(n.id,n.kind)}
              >
                <strong>{n.kind==="task"?tasks.reminderLabel:n.kind==="sms"?n.title:p.newMessage}</strong>
                <span>{n.kind==="task"?n.title:n.kind==="sms"?n.body_preview:`${p.from}: ${n.title}`}</span>{n.kind==="message"&&<span className="preview-lines">{messagePreview(n.body_preview ?? "")}</span>}
              </Link>
              {n.kind==="task"&&<button className="notification-dismiss" aria-label={`${tasks.snooze}: ${n.title}`} title={tasks.snooze} onClick={()=>void snooze(n.id)}><Clock3 aria-hidden="true"/></button>}
              <button
                className="notification-dismiss"
                aria-label={p.close}
                onClick={() =>
                  setToasts((old) => old.filter((t) => t.id !== n.id))
                }
              >
                <Cross2Icon aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
