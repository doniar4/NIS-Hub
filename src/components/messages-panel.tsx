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
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <h2 className="section-title text-xl">{p.newChat}</h2>
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--muted)]">
            Direct
          </span>
        </div>

        <form
          className="space-y-3 mt-4"
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
              placeholder={p.exactName}
            />
          </label>
          <p id="dm-name-hint" className="text-xs text-[var(--muted)]">
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
            <ReloadButton className="mt-3 w-full" onClick={() => void refresh()}>
              {p.retry}
            </ReloadButton>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">
              {p.messages} ({threads.length})
            </span>
          </div>

          <nav className="conversation-list" aria-label={p.messages}>
            {!loaded ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded bg-[var(--sidebar)] opacity-60 animate-pulse"
                  >
                    <div className="h-9 w-9 rounded-full bg-[var(--line-strong)]" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-3/4 rounded bg-[var(--line-strong)]" />
                      <div className="h-2 w-1/2 rounded bg-[var(--line)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !threads.length ? (
              <div className="p-4 text-center rounded border border-dashed border-[var(--line)]">
                <p className="text-xs text-[var(--muted)]">{p.noThreads}</p>
              </div>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className="conversation-link w-full text-left"
                  aria-current={thread.id === active ? "page" : undefined}
                  onClick={() => setActive(thread.id)}
                >
                  <div className="relative">
                    <span className="conversation-initial" aria-hidden="true">
                      {thread.peer_name?.slice(0, 1).toLocaleUpperCase() || "N"}
                    </span>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--accent)]"
                      title="Active"
                    />
                  </div>
                  <span className="min-w-0 flex-1 ml-2">
                    <strong className="text-sm font-medium text-[var(--ink)] truncate block">
                      {thread.peer_name}
                    </strong>
                    <span className="conversation-preview text-xs text-[var(--muted)] truncate block mt-0.5">
                      {thread.last_body ?? p.emptyChat}
                    </span>
                  </span>
                  {thread.unread > 0 && (
                    <span className="unread-count ml-auto shadow-sm">
                      {thread.unread}
                    </span>
                  )}
                </button>
              ))
            )}
          </nav>
        </div>
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
        <section className="surface-card conversation-empty flex flex-col items-center justify-center p-12 text-center min-h-[460px]">
          <div className="h-16 w-16 rounded-full bg-[var(--sidebar)] flex items-center justify-center mb-4 text-[var(--accent)] border border-[var(--line)]">
            <ChatBubbleIcon className="w-8 h-8" aria-hidden="true" />
          </div>
          <h2 className="section-title text-2xl mb-2">{p.messages}</h2>
          <p className="text-sm text-[var(--muted)] max-w-xs">{p.chooseChat}</p>
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
      <header className="conversation-heading flex items-center justify-between pb-4 border-b border-[var(--line)]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="conversation-initial shadow-sm" aria-hidden="true">
              {thread.peer_name.slice(0, 1).toLocaleUpperCase()}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--surface)] bg-[var(--accent)]" />
          </div>
          <div>
            <h2 className="section-title text-xl font-semibold text-[var(--ink)]">
              {thread.peer_name}
            </h2>
            <p className="text-xs text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              {p.privateChat}
            </p>
          </div>
        </div>
      </header>
      {more && (
        <button
          className="text-link justify-center text-sm py-2 my-1"
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
        <p role="alert" className="form-error my-2">
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
          <li role="status" className="p-4 text-center text-xs text-[var(--muted)] animate-pulse">
            {p.loading}
          </li>
        ) : messages.length === 0 ? (
          <li className="conversation-empty p-8 text-center text-sm text-[var(--muted)]">
            {p.emptyChat}
          </li>
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
        className="message-compose mt-3 pt-3 border-t border-[var(--line)]"
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
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            onChange={(event) => {
              setText(event.target.value);
              saveDraft(event.target.value);
            }}
            placeholder={p.message}
          />
        </label>
        <button
          className="button flex items-center gap-2 px-4"
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
