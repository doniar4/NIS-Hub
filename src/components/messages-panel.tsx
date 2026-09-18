"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChatBubbleIcon, PaperPlaneIcon } from "@radix-ui/react-icons";
import {
  loadInbox,
  startConversation,
  loadMessages,
  sendMessage,
  markConversationRead,
} from "@/lib/community-client";
import type { DirectMessage, DmThread } from "@/lib/database.types";
import { communityCopy } from "@/lib/community-copy";
import { useI18n } from "./locale-provider";
import { ReloadButton } from "./reload-button";

export function MessagesPanel({
  userId,
  initialThread,
}: {
  userId: string;
  initialThread?: string;
}) {
  const { locale } = useI18n(),
    p = communityCopy(locale);
  const [threads, setThreads] = useState<DmThread[]>([]),
    [active, setActive] = useState(initialThread ?? ""),
    [name, setName] = useState("");
  const [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [pending, start] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    const result = await loadInbox();
    if ("error" in result) setError(p[result.error]);
    else {
      setThreads(result.data);
      setError("");
    }
    setLoaded(true);
  }, [p]);
  useEffect(() => {
    let alive = true;
    let running = false;
    const poll = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const result = await loadInbox();
        if (!alive) return;
        if ("error" in result) setError(p[result.error]);
        else {
          setThreads(result.data);
          setError("");
        }
        setLoaded(true);
      } finally {
        running = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 15000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [p]);
  const current = threads.find((t) => t.id === active);
  return (
    <div className="messages-layout">
      <aside className="surface-card messages-index">
        <h2 className="section-title">{p.newChat}</h2>
        <form
          className="space-y-3 mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              const result = await startConversation(name);
              if ("error" in result) {
                setError(p[result.error]);
                return;
              }
              setActive(result.id);
              setName("");
              await refresh();
            });
          }}
        >
          <label>
            <span className="field-label">{p.recipient}</span>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              autoComplete="off"
              aria-describedby="dm-name-hint"
            />
          </label>
          <p id="dm-name-hint" className="text-sm text-[var(--muted)]">
            {p.exactName}
          </p>
          <button className="button w-full" disabled={pending}>
            {pending ? p.loading : p.start}
          </button>
        </form>
        {error && (
          <div className="mt-4">
            <p role="alert" className="form-error">
              {error}
            </p>
            <ReloadButton className="mt-3" onClick={() => void refresh()}>
              {p.retry}
            </ReloadButton>
          </div>
        )}
        <nav className="conversation-list" aria-label={p.messages}>
          {!loaded ? (
            <p role="status">{p.loading}</p>
          ) : !threads.length ? (
            <p className="text-sm text-[var(--muted)]">{p.noThreads}</p>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className="conversation-link"
                aria-current={thread.id === active ? "page" : undefined}
                onClick={() => setActive(thread.id)}
              >
                <span className="conversation-initial" aria-hidden="true">
                  {thread.peer_name?.slice(0, 1).toLocaleUpperCase() || "N"}
                </span>
                <span className="min-w-0 flex-1">
                  <strong>{thread.peer_name}</strong>
                  <span className="conversation-preview">
                    {thread.last_body ?? p.emptyChat}
                  </span>
                </span>
                {thread.unread > 0 && (
                  <span className="unread-count">{thread.unread}</span>
                )}
              </button>
            ))
          )}
        </nav>
      </aside>
      {current ? (
        <Conversation
          key={current.id}
          thread={current}
          userId={userId}
          draft={drafts[current.id] ?? ""}
          saveDraft={(value) =>
            setDrafts((old) => ({ ...old, [current.id]: value }))
          }
          onRead={refresh}
        />
      ) : (
        <section className="surface-card conversation-empty">
          <ChatBubbleIcon aria-hidden="true" />
          <h2 className="section-title">{p.messages}</h2>
          <p>{p.chooseChat}</p>
        </section>
      )}
    </div>
  );
}

function Conversation({
  thread,
  userId,
  draft,
  saveDraft,
  onRead,
}: {
  thread: DmThread;
  userId: string;
  draft: string;
  saveDraft: (value: string) => void;
  onRead: () => Promise<void>;
}) {
  const { locale } = useI18n(),
    p = communityCopy(locale);
  const [messages, setMessages] = useState<DirectMessage[]>([]),
    [text, setText] = useState(draft),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [olderBusy, setOlderBusy] = useState(false),
    [pending, start] = useTransition();
  const list = useRef<HTMLOListElement>(null),
    client = useRef<{ body: string; id: string } | null>(null),
    lastSeen = useRef(""),
    latestIds = useRef(new Set<string>());
  const active = useRef(true),
    nearBottom = useRef(true);
  const merge = useCallback(
    (rows: DirectMessage[]) =>
      setMessages((old) =>
        Array.from(
          new Map([...old, ...rows].map((m) => [m.id, m])).values(),
        ).sort(
          (a, b) =>
            a.created_at.localeCompare(b.created_at) ||
            a.id.localeCompare(b.id),
        ),
      ),
    [],
  );
  const read = useCallback(
    async (rows: DirectMessage[]) => {
      const last = rows.at(-1);
      if (!last || document.hidden || last.id === lastSeen.current) return;
      const result = await markConversationRead(thread.id, last.id);
      if ("ok" in result) {
        lastSeen.current = last.id;
        window.dispatchEvent(new Event("nis-notifications-change"));
        await onRead();
      }
    },
    [thread.id, onRead],
  );
  useEffect(() => {
    active.current = true;
    let busy = false,
      first = true;
    const poll = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const result = await loadMessages(thread.id);
        if (!active.current) return;
        if ("error" in result) setError(p[result.error]);
        else {
          const gap = result.more && latestIds.current.size > 0 && !result.data.some(m => latestIds.current.has(m.id));
          if (gap) { setMessages(result.data); nearBottom.current = true; }
          else merge(result.data);
          latestIds.current = new Set(result.data.map(m => m.id));
          if (first || gap) {
            setMore(result.more);
            first = false;
          }
          setError("");
          if (nearBottom.current) await read(result.data);
        }
        if (active.current) setLoading(false);
      } finally {
        busy = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 10000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      active.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [thread.id, p, merge, read]);
  useEffect(() => {
    if (nearBottom.current && list.current)
      list.current.scrollTop = list.current.scrollHeight;
  }, [messages]);
  return (
    <section className="surface-card conversation-panel">
      <header className="conversation-heading">
        <span className="conversation-initial" aria-hidden="true">
          {thread.peer_name.slice(0, 1).toLocaleUpperCase()}
        </span>
        <div>
          <h2 className="section-title">{thread.peer_name}</h2>
          <p>{p.privateChat}</p>
        </div>
      </header>
      {more && (
        <button
          className="text-link justify-center"
          disabled={olderBusy}
          onClick={async () => {
            const first = messages[0];
            if (!first) return;
            setOlderBusy(true);
            const result = await loadMessages(thread.id, {
              at: first.created_at,
              id: first.id,
            });
            if (active.current) {
              if ("error" in result) setError(p[result.error]);
              else {
                const element = list.current,
                  oldHeight = element?.scrollHeight ?? 0;
                nearBottom.current = false;
                merge(result.data);
                setMore(result.more);
                requestAnimationFrame(() => {
                  if (element)
                    element.scrollTop += element.scrollHeight - oldHeight;
                });
              }
              setOlderBusy(false);
            }
          }}
        >
          {olderBusy ? p.loading : p.older}
        </button>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <ol
        ref={list}
        className="message-history"
        aria-label={p.messages}
        tabIndex={0}
        onScroll={() => {
          const el = list.current;
          if (el) {
            nearBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (nearBottom.current) void read(messages);
          }
        }}
      >
        {loading ? (
          <li role="status">{p.loading}</li>
        ) : messages.length === 0 ? (
          <li className="conversation-empty">{p.emptyChat}</li>
        ) : (
          messages.map((m) => (
            <li
              key={m.id}
              className={
                m.sender_id === userId
                  ? "message-bubble message-own"
                  : "message-bubble"
              }
            >
              <p>{m.body}</p>
              <time dateTime={m.created_at}>
                {new Intl.DateTimeFormat(locale, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(m.created_at))}
              </time>
            </li>
          ))
        )}
      </ol>
      <form
        className="message-compose"
        onSubmit={(event) => {
          event.preventDefault();
          const body = text.trim();
          if (!body || pending) return;
          if (client.current?.body !== body)
            client.current = { body, id: crypto.randomUUID() };
          const nonce = client.current.id;
          start(async () => {
            const result = await sendMessage(thread.id, body, nonce);
            if (!active.current) return;
            if ("error" in result) {
              setError(result.error === "rate" ? p.rate : p.sendFailed);
              return;
            }
            setText("");
            saveDraft("");
            client.current = null;
            nearBottom.current = true;
            const latest = await loadMessages(thread.id);
            if (!active.current) return;
            if ("data" in latest) {
              merge(latest.data);
              setError("");
              await read(latest.data);
            } else setError(p.failed);
          });
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">{p.message}</span>
          <textarea
            className="field"
            rows={2}
            maxLength={2000}
            required
            value={text}
            disabled={pending}
            onChange={(event) => {
              setText(event.target.value);
              saveDraft(event.target.value);
            }}
            placeholder={p.message}
          />
        </label>
        <button
          className="button"
          disabled={pending || !text.trim()}
          aria-label={p.send}
        >
          <PaperPlaneIcon aria-hidden="true" />
          <span>{pending ? p.loading : p.send}</span>
        </button>
      </form>
    </section>
  );
}
