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
import { loadNotifications, dismissNotification } from "@/lib/community-client";
import type { WebNotification } from "@/lib/database.types";
import { communityCopy } from "@/lib/community-copy";
import { useI18n } from "./locale-provider";
export function NotificationCenter() {
  const { locale } = useI18n(),
    p = communityCopy(locale);
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<WebNotification[]>([]),
    [unread, setUnread] = useState(0),
    [toasts, setToasts] = useState<WebNotification[]>([]),
    [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    seen = useRef<Set<string> | null>(null);
  const refresh = useCallback(async () => {
    const result = await loadNotifications();
    if ("error" in result) {
      setError(p[result.error]);
      return;
    }
    setItems(result.data);
    setUnread(result.unread);
    setError("");
    const previous = seen.current;
    seen.current = new Set(result.data.map((n) => n.id));
    if (previous) {
      const fresh = result.data.filter(
        (n) => !previous.has(n.id) && !n.read_at,
      );
      const readIds = new Set(result.data.filter(n => n.read_at).map(n => n.id));
      setToasts((old) =>
          Array.from(
            new Map([...old.filter(n => !readIds.has(n.id) && result.data.some(current=>current.id===n.id)).map(n=>result.data.find(current=>current.id===n.id)??n), ...fresh].map((n) => [n.id, n])).values(),
          ).slice(-3),
        );
    }
  }, [p]);
  useEffect(() => {
    let alive = true,
      busy = false;
    const poll = async () => {
      if (busy || document.hidden || !alive) return;
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
    document.addEventListener("visibilitychange", poll);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("nis-notifications-change", poll);
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
  const dismiss = async (id: string) => {
    const result = await dismissNotification(id);
    if ("error" in result) {
      setError(p[result.error]);
      return;
    }
    setToasts((old) => old.filter((n) => n.id !== id));
    await refresh();
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
                    <ChatBubbleIcon aria-hidden="true" />
                  </span>
                  <Link
                    href={`/messages?thread=${n.thread_id}`}
                    onClick={() => {
                      setOpen(false);
                      void dismiss(n.id);
                    }}
                    className="notification-copy"
                  >
                    <strong>{n.actor_name}</strong>
                    <span className="preview-lines">{messagePreview(n.body_preview ?? "")}</span>
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
                    <button
                      className="notification-dismiss"
                      aria-label={`${p.markRead}: ${n.actor_name}`}
                      onClick={() => void dismiss(n.id)}
                    >
                      <CheckIcon aria-hidden="true" />
                    </button>
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
                <ChatBubbleIcon aria-hidden="true" />
              </span>
              <Link
                className="notification-copy"
                href={`/messages?thread=${n.thread_id}`}
                onClick={() => void dismiss(n.id)}
              >
                <strong>{p.newMessage}</strong>
                <span>
                  {p.from}: {n.actor_name}
                </span><span className="preview-lines">{messagePreview(n.body_preview ?? "")}</span>
              </Link>
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
