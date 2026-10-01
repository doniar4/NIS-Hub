"use client";
import Link from "next/link";
import { SafetyMenu } from "./safety-menu";
import { v053Copy } from "@/lib/v053-copy";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChatBubbleIcon, PaperPlaneIcon } from "@radix-ui/react-icons";
import {
  Search,
  Pin,
  PinOff,
  Reply,
  Users,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
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

type StudyGroup = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  membersCount: number;
  initials: string;
  description: string;
};

const STUDY_GROUPS: StudyGroup[] = [
  {
    id: "group-math-9a",
    name: "Математика 9А",
    subject: "Алгебра & Геометрия",
    grade: "9",
    membersCount: 22,
    initials: "М9",
    description: "Разбор задач СОР/СОЧ и олимпиадной математики.",
  },
  {
    id: "group-phys-10c",
    name: "Физика 10С",
    subject: "Механика & Термодинамика",
    grade: "10",
    membersCount: 26,
    initials: "Ф1",
    description: "Подготовка к лабораторным работам и разбор формул.",
  },
  {
    id: "group-cs-10",
    name: "Информатика 10",
    subject: "Алгоритмы & Python",
    grade: "10",
    membersCount: 19,
    initials: "И1",
    description: "Алгоритмы поиска, графы и олимпиадное программирование.",
  },
  {
    id: "group-chem-9",
    name: "Химия 9",
    subject: "Неорганическая химия",
    grade: "9",
    membersCount: 17,
    initials: "Х9",
    description: "Реакции, уравнения и подготовка к формативным работам.",
  },
];

type GroupMessage = {
  id: string;
  author: string;
  authorId: string;
  body: string;
  created_at: string;
  reactions?: Record<string, number>;
};

const EMOJI_REACTIONS = ["👍", "❤️", "💡", "🔥"];

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

  // Tab: all | pinned | groups
  const [tab, setTab] = useState<"all" | "pinned" | "groups">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // Load pinned threads from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nis-pinned-threads");
      if (raw) setPinnedIds(JSON.parse(raw));
    } catch {}
  }, []);

  const togglePin = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPinnedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      try {
        localStorage.setItem("nis-pinned-threads", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

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

  const currentDm = threads.find((t) => t.id === active);
  const currentGroup = STUDY_GROUPS.find((g) => g.id === active);
  const indexRef = useRef<HTMLElement>(null);

  function selectThread(id: string) {
    setActive(id);
    if (window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLButtonElement>(".conversation-back")?.focus(),
      );
    }
  }

  function backToList() {
    setActive("");
    requestAnimationFrame(() =>
      indexRef.current?.querySelector<HTMLButtonElement>(".conversation-link")?.focus(),
    );
  }

  // Filter threads by search query and tab
  const filteredThreads = threads
    .filter((t) => {
      if (tab === "pinned" && !pinnedIds.includes(t.id)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.peer_name.toLowerCase().includes(q) ||
        (t.last_body && t.last_body.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id) ? 1 : 0;
      const bPinned = pinnedIds.includes(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return (b.last_at || "").localeCompare(a.last_at || "");
    });

  const filteredGroups = STUDY_GROUPS.filter((g) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return g.name.toLowerCase().includes(q) || g.subject.toLowerCase().includes(q);
  });

  return (
    <div className="messages-layout" data-conversation-open={Boolean(currentDm || currentGroup)}>
      <aside ref={indexRef} className="surface-card messages-index">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <h2 className="section-title text-xl">{p.newChat}</h2>
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
              selectThread(result.id);
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
          {/* Symmetrical, equal-width Tab Pills without emojis */}
          <div className="tab-pills" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "all"}
              className="tab-pill"
              onClick={() => setTab("all")}
            >
              {p.all} ({threads.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "pinned"}
              className="tab-pill"
              onClick={() => setTab("pinned")}
            >
              {p.pinned} ({threads.filter((t) => pinnedIds.includes(t.id)).length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "groups"}
              className="tab-pill"
              onClick={() => setTab("groups")}
            >
              {p.studyGroups}
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted)] pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tab === "groups" ? (locale === "kk" ? "Топтарды іздеу…" : locale === "en" ? "Search groups…" : "Поиск групп…") : p.searchChats}
              className="field pl-8 text-xs py-1.5 h-8 w-full"
            />
          </div>

          {tab === "groups" ? (
            <nav className="conversation-list" aria-label={p.studyGroups}>
              {filteredGroups.map((group) => {
                const isSelected = active === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    className="conversation-link w-full text-left"
                    aria-current={isSelected ? "page" : undefined}
                    onClick={() => selectThread(group.id)}
                  >
                    <div className="relative">
                      <span className="conversation-initial bg-[var(--accent-wash)] text-[var(--accent)] font-bold shadow-sm" aria-hidden="true">
                        {group.initials}
                      </span>
                    </div>
                    <span className="min-w-0 flex-1 ml-2">
                      <strong className="text-sm font-medium text-[var(--ink)] truncate block">
                        {group.name}
                      </strong>
                      <span className="conversation-preview text-xs text-[var(--muted)] truncate block mt-0.5">
                        {group.subject} · {group.membersCount} уч.
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          ) : (
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
              ) : !filteredThreads.length ? (
                <div className="p-4 text-center rounded border border-dashed border-[var(--line)]">
                  <p className="text-xs text-[var(--muted)]">
                    {searchQuery ? "Ничего не найдено" : tab === "pinned" ? "Нет закрепленных чатов" : p.noThreads}
                  </p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isPinned = pinnedIds.includes(thread.id);
                  const isSelected = thread.id === active;
                  return (
                    <div
                      key={thread.id}
                      className="relative group flex items-center"
                    >
                      <button
                        type="button"
                        className="conversation-link w-full text-left pr-8"
                        aria-current={isSelected ? "page" : undefined}
                        onClick={() => selectThread(thread.id)}
                      >
                        <div className="relative">
                          <span className="conversation-initial" aria-hidden="true">
                            {thread.peer_name?.slice(0, 1).toLocaleUpperCase() || "N"}
                          </span>
                        </div>
                        <span className="min-w-0 flex-1 ml-2">
                          <span className="flex items-center gap-1.5">
                            <strong className="text-sm font-medium text-[var(--ink)] truncate block">
                              {thread.peer_name}
                            </strong>
                            {isPinned && (
                              <Pin className="w-3 h-3 text-[var(--accent)] shrink-0 inline" aria-label={p.pinned} />
                            )}
                          </span>
                          <span className="conversation-preview text-xs text-[var(--muted)] truncate block mt-0.5">
                            {thread.last_deleted
                              ? v053Copy(locale).deleted
                              : (thread.last_body ?? p.emptyChat)}
                          </span>
                        </span>
                        {thread.unread > 0 && (
                          <span className="unread-count ml-auto shadow-sm">
                            {thread.unread}
                          </span>
                        )}
                      </button>

                      {/* Pin Toggle Button */}
                      <button
                        type="button"
                        onClick={(e) => togglePin(thread.id, e)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-[var(--hover)] text-[var(--muted)] transition-opacity"
                        aria-label={isPinned ? p.unpin : p.pin}
                        title={isPinned ? p.unpin : p.pin}
                      >
                        {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })
              )}
            </nav>
          )}
        </div>
      </aside>

      {currentGroup ? (
        <StudyGroupChat
          key={currentGroup.id}
          group={currentGroup}
          userId={userId}
          onBack={backToList}
        />
      ) : currentDm ? (
        <Conversation
          key={currentDm.id}
          thread={currentDm}
          userId={userId}
          draft={drafts[currentDm.id] ?? ""}
          saveDraft={(value) =>
            setDrafts((old) => ({ ...old, [currentDm.id]: value }))
          }
          onRead={refresh}
          onBack={backToList}
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
  onBack,
}: {
  thread: DmThread;
  userId: string;
  draft: string;
  saveDraft: (value: string) => void;
  onRead: () => Promise<void>;
  onBack: () => void;
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

  // Search inside chat
  const [inChatSearch, setInChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");

  // Read receipts preference
  const [readReceipts, setReadReceipts] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("nis-send-read-receipts") !== "false";
  });

  const toggleReadReceipts = () => {
    setReadReceipts((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("nis-send-read-receipts", String(next));
      } catch {}
      return next;
    });
  };

  // Reply target
  const [replyTarget, setReplyTarget] = useState<{
    id: string;
    author: string;
    body: string;
  } | null>(null);

  // Message Reactions stored locally
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem("nis-reactions-" + thread.id);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const addReaction = (messageId: string, emoji: string) => {
    setReactions((prev) => {
      const msgReactions = { ...(prev[messageId] || {}) };
      msgReactions[emoji] = (msgReactions[emoji] || 0) + 1;
      const next = { ...prev, [messageId]: msgReactions };
      try {
        localStorage.setItem("nis-reactions-" + thread.id, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Peer typing simulated status
  const [peerTyping, setPeerTyping] = useState(false);

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
      if (!readReceipts) return;
      const last = rows.at(-1);
      if (!last || document.hidden || last.id === lastSeen.current) return;
      const result = await markConversationRead(thread.id, last.id);
      if ("ok" in result) {
        lastSeen.current = last.id;
        window.dispatchEvent(new Event("nis-notifications-change"));
        await onRead();
      }
    },
    [thread.id, onRead, readReceipts],
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
          const gap =
            result.more &&
            latestIds.current.size > 0 &&
            !result.data.some((m) => latestIds.current.has(m.id));
          if (gap) {
            setMessages(result.data);
            nearBottom.current = true;
          } else merge(result.data);
          latestIds.current = new Set(result.data.map((m) => m.id));
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

  // Filter messages if search is active
  const displayedMessages = chatSearchQuery.trim()
    ? messages.filter((m) =>
        m.body.toLowerCase().includes(chatSearchQuery.toLowerCase()),
      )
    : messages;

  return (
    <section className="surface-card conversation-panel flex flex-col h-full">
      <header className="conversation-heading flex items-center justify-between pb-3 border-b border-[var(--line)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="icon-button conversation-back"
            onClick={onBack}
            aria-label={v053Copy(locale).previous}
          >
            ←
          </button>
          <Link
            href={"/people/" + thread.peer_id + "?thread=" + thread.id}
            className="conversation-profile flex items-center gap-2"
          >
            <div className="relative">
              <span className="conversation-initial shadow-sm" aria-hidden="true">
                {thread.peer_name.slice(0, 1).toLocaleUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="section-title text-base sm:text-lg font-semibold text-[var(--ink)] leading-snug">
                {thread.peer_name}
              </h2>
              <span className="conversation-profile-label text-xs">
                {v053Copy(locale).viewProfile} <span aria-hidden="true">→</span>
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Search Toggle */}
          <button
            type="button"
            onClick={() => setInChatSearch(!inChatSearch)}
            className="icon-button p-2 text-[var(--muted)] hover:text-[var(--ink)]"
            title={p.searchMessages}
            aria-label={p.searchMessages}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Read Receipts Toggle */}
          <button
            type="button"
            onClick={toggleReadReceipts}
            className="icon-button p-2 text-[var(--muted)] hover:text-[var(--ink)]"
            title={`${p.readReceipts}: ${readReceipts ? "Вкл" : "Выкл"}`}
            aria-label={p.readReceipts}
          >
            {readReceipts ? <Eye className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <SafetyMenu peer={thread.peer_id} thread={thread.id} onDone={onRead} />
        </div>
      </header>

      {/* In-Chat Search Bar */}
      {inChatSearch && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--hover)] border-b border-[var(--line)]">
          <Search className="w-3.5 h-3.5 text-[var(--muted)]" />
          <input
            type="search"
            autoFocus
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            placeholder={p.searchMessages}
            className="field text-xs py-1 h-7 flex-1"
          />
          <button
            type="button"
            onClick={() => {
              setChatSearchQuery("");
              setInChatSearch(false);
            }}
            className="icon-button p-1 text-[var(--muted)]"
            aria-label={p.close}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <p className="conversation-privacy px-4 py-1 text-xs text-[var(--muted)]">
        {p.privateChat}
      </p>

      {more && (
        <button
          className="button button-secondary button-small older-messages mx-auto my-2"
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
        <p role="alert" className="form-error my-2 mx-4">
          {error}
        </p>
      )}

      <ol
        ref={list}
        className="message-history flex-1 overflow-y-auto px-4 py-2 space-y-3"
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
          <li
            role="status"
            className="p-4 text-center text-xs text-[var(--muted)] animate-pulse"
          >
            {p.loading}
          </li>
        ) : displayedMessages.length === 0 ? (
          <li className="conversation-empty p-8 text-center text-sm text-[var(--muted)]">
            {chatSearchQuery ? "Сообщений по запросу не найдено" : p.emptyChat}
          </li>
        ) : (
          displayedMessages.map((m) => {
            const isOwn = m.sender_id === userId;
            const quoteMatch = m.body.match(/^> ([^\n]+)\n\n([\s\S]*)$/);
            const msgReactions = reactions[m.id] || {};

            return (
              <li
                key={m.id}
                className={`group relative flex flex-col ${
                  isOwn ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`message-bubble relative max-w-[85%] ${
                    isOwn ? "message-own" : ""
                  }`}
                >
                  {quoteMatch && !m.deleted_at && (
                    <div className="message-quote">
                      {quoteMatch[1]}
                    </div>
                  )}

                  <p>
                    {m.deleted_at
                      ? v053Copy(locale).deleted
                      : quoteMatch
                      ? quoteMatch[2]
                      : m.body}
                  </p>

                  <div className="message-meta flex items-center justify-between gap-2 mt-1">
                    <time dateTime={m.created_at} className="text-[10px] text-[var(--muted)]">
                      {new Intl.DateTimeFormat(locale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(m.created_at))}
                    </time>
                    {!m.deleted_at && (
                      <SafetyMenu
                        message={m.id}
                        own={isOwn}
                        onDone={() => {
                          void loadMessages(thread.id).then((result) => {
                            if ("data" in result) merge(result.data);
                          });
                        }}
                      />
                    )}
                  </div>

                  {Object.keys(msgReactions).length > 0 && (
                    <div className="message-reactions">
                      {Object.entries(msgReactions).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          type="button"
                          className="message-reaction-badge"
                          onClick={() => addReaction(m.id, emoji)}
                          title={`Реакция ${emoji}`}
                        >
                          <span>{emoji}</span>
                          <span className="font-semibold">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {!m.deleted_at && (
                  <div
                    className={`message-actions-hover opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 ${
                      isOwn ? "mr-1" : "ml-1"
                    }`}
                  >
                    {EMOJI_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => addReaction(m.id, emoji)}
                        className="p-1 text-xs hover:scale-125 transition-transform"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setReplyTarget({
                          id: m.id,
                          author: isOwn ? "Вы" : thread.peer_name,
                          body: quoteMatch ? quoteMatch[2] : m.body,
                        })
                      }
                      className="p-1 text-xs text-[var(--muted)] hover:text-[var(--accent)] flex items-center gap-0.5"
                      title={p.reply}
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })
        )}
      </ol>

      {peerTyping && (
        <div className="message-typing-indicator px-4">
          {thread.peer_name} {p.typing}
        </div>
      )}

      {thread.blocked && (
        <p role="status" className="p-3 text-center text-xs text-[var(--muted)]">
          {v053Copy(locale).blocked}
        </p>
      )}

      <form
        className="message-compose mt-auto p-3 border-t border-[var(--line)] bg-[var(--surface)]"
        onSubmit={(event) => {
          event.preventDefault();
          const cleanText = text.trim();
          if (!cleanText || pending || thread.blocked) return;

          let finalBody = cleanText;
          if (replyTarget) {
            const shortQuote = replyTarget.body.replace(/\n/g, " ").slice(0, 100);
            finalBody = `> ${replyTarget.author}: ${shortQuote}\n\n${cleanText}`;
          }

          if (client.current?.body !== finalBody)
            client.current = { body: finalBody, id: crypto.randomUUID() };
          const nonce = client.current.id;

          start(async () => {
            const result = await sendMessage(thread.id, finalBody, nonce);
            if (!active.current) return;
            if ("error" in result) {
              setError(result.error === "rate" ? p.rate : p.sendFailed);
              return;
            }
            setText("");
            saveDraft("");
            setReplyTarget(null);
            client.current = null;
            nearBottom.current = true;

            setPeerTyping(true);
            setTimeout(() => setPeerTyping(false), 3000);

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
        {replyTarget && (
          <div className="message-reply-preview">
            <span className="truncate">
              {p.replyingTo} <strong>{replyTarget.author}</strong>: «
              {replyTarget.body.slice(0, 60)}
              {replyTarget.body.length > 60 ? "…" : ""}»
            </span>
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              className="p-1 hover:text-[var(--accent)]"
              aria-label={p.cancelReply}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{p.message}</span>
            <textarea
              className="field w-full resize-none"
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
            className="button flex items-center justify-center p-3 h-10 w-10 shrink-0"
            disabled={pending || !text.trim() || thread.blocked}
            aria-label={p.send}
            title={p.send}
          >
            <PaperPlaneIcon className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}

function StudyGroupChat({
  group,
  userId,
  onBack,
}: {
  group: StudyGroup;
  userId: string;
  onBack: () => void;
}) {
  const { locale } = useI18n(),
    p = communityCopy(locale);
  const [messages, setMessages] = useState<GroupMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("nis-group-msgs-" + group.id);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [text, setText] = useState("");
  const [replyTarget, setReplyTarget] = useState<GroupMessage | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const saveGroupMessages = (msgs: GroupMessage[]) => {
    setMessages(msgs);
    try {
      localStorage.setItem("nis-group-msgs-" + group.id, JSON.stringify(msgs));
    } catch {}
  };

  const addReaction = (messageId: string, emoji: string) => {
    const updated = messages.map((m) => {
      if (m.id !== messageId) return m;
      const reactions = { ...(m.reactions || {}) };
      reactions[emoji] = (reactions[emoji] || 0) + 1;
      return { ...m, reactions };
    });
    saveGroupMessages(updated);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;

    let finalBody = clean;
    if (replyTarget) {
      finalBody = `> ${replyTarget.author}: ${replyTarget.body.slice(0, 80)}\n\n${clean}`;
    }

    const newMsg: GroupMessage = {
      id: "gm-" + Date.now(),
      author: "Вы",
      authorId: userId,
      body: finalBody,
      created_at: new Date().toISOString(),
      reactions: {},
    };

    saveGroupMessages([...messages, newMsg]);
    setText("");
    setReplyTarget(null);
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  return (
    <section className="surface-card conversation-panel flex flex-col h-full">
      <header className="conversation-heading flex items-center justify-between pb-3 border-b border-[var(--line)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="icon-button conversation-back"
            onClick={onBack}
            aria-label={v053Copy(locale).previous}
          >
            ←
          </button>
          <div className="relative">
            <span className="conversation-initial bg-[var(--accent-wash)] text-[var(--accent)] font-bold shadow-sm" aria-hidden="true">
              {group.initials}
            </span>
          </div>
          <div>
            <h2 className="section-title text-base sm:text-lg font-semibold text-[var(--ink)] leading-snug">
              {group.name}
            </h2>
            <span className="text-xs text-[var(--muted)]">
              {group.subject} · {group.membersCount} участников
            </span>
          </div>
        </div>
      </header>

      <div className="p-3 bg-[var(--hover)] border-b border-[var(--line)] text-xs text-[var(--muted)] flex items-center gap-2">
        <Users className="w-4 h-4 text-[var(--accent)] shrink-0" />
        <span>{group.description}</span>
      </div>

      <ol
        ref={listRef}
        className="message-history flex-1 overflow-y-auto px-4 py-2 space-y-3"
        aria-label={group.name}
      >
        {messages.length === 0 ? (
          <li className="conversation-empty p-8 text-center text-sm text-[var(--muted)]">
            {locale === "kk"
              ? "Әзірге хабарламалар жоқ. Алғашқы болып жазыңыз."
              : locale === "en"
              ? "No messages yet. Start the conversation."
              : "Сообщений пока нет. Начните обсуждение первым."}
          </li>
        ) : (
          messages.map((m) => {
            const isOwn = m.authorId === userId || m.author === "Вы";
            const quoteMatch = m.body.match(/^> ([^\n]+)\n\n([\s\S]*)$/);

            return (
              <li
                key={m.id}
                className={`group relative flex flex-col ${
                  isOwn ? "items-end" : "items-start"
                }`}
              >
                <span className="text-[11px] font-semibold text-[var(--muted)] mb-0.5 px-1">
                  {m.author}
                </span>
                <div
                  className={`message-bubble relative max-w-[85%] ${
                    isOwn ? "message-own" : ""
                  }`}
                >
                  {quoteMatch && (
                    <div className="message-quote">
                      {quoteMatch[1]}
                    </div>
                  )}
                  <p>{quoteMatch ? quoteMatch[2] : m.body}</p>

                  <div className="message-meta mt-1 text-[10px] text-[var(--muted)]">
                    <time dateTime={m.created_at}>
                      {new Intl.DateTimeFormat(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(m.created_at))}
                    </time>
                  </div>

                  {m.reactions && Object.keys(m.reactions).length > 0 && (
                    <div className="message-reactions">
                      {Object.entries(m.reactions).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          type="button"
                          className="message-reaction-badge"
                          onClick={() => addReaction(m.id, emoji)}
                        >
                          <span>{emoji}</span>
                          <span className="font-semibold">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className={`message-actions-hover opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 ${
                    isOwn ? "mr-1" : "ml-1"
                  }`}
                >
                  {EMOJI_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => addReaction(m.id, emoji)}
                      className="p-1 text-xs hover:scale-125 transition-transform"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setReplyTarget(m)}
                    className="p-1 text-xs text-[var(--muted)] hover:text-[var(--accent)] flex items-center gap-0.5"
                    title={p.reply}
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ol>

      <form
        className="message-compose mt-auto p-3 border-t border-[var(--line)] bg-[var(--surface)]"
        onSubmit={handleSend}
      >
        {replyTarget && (
          <div className="message-reply-preview">
            <span className="truncate">
              {p.replyingTo} <strong>{replyTarget.author}</strong>: «
              {replyTarget.body.slice(0, 60)}…»
            </span>
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              className="p-1 hover:text-[var(--accent)]"
              aria-label={p.cancelReply}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{p.message}</span>
            <textarea
              className="field w-full resize-none"
              rows={2}
              maxLength={2000}
              required
              value={text}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              onChange={(e) => setText(e.target.value)}
              placeholder="Написать в учебную группу…"
            />
          </label>
          <button
            type="submit"
            className="button flex items-center justify-center p-3 h-10 w-10 shrink-0"
            disabled={!text.trim()}
            aria-label={p.send}
            title={p.send}
          >
            <PaperPlaneIcon className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}
