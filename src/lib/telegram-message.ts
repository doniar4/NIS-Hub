import type {TicketCategory} from "./database.types";
import {v05Copy} from "./v05-copy";
import {uuid} from "./validation";

export type TicketNotice = {
  id: string; category: TicketCategory; createdAt: string;
  title: string; preview: string; displayName?: string | null;
};
export const TELEGRAM_PREVIEW_LIMIT = 400;

/** Best-effort minimization, not a guarantee that free text contains no personal data. */
function noticeText(value: string, limit: number): string {
  const text = value.normalize("NFC")
    .replace(/[\p{Cc}\p{Cs}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, " ")
    .replace(/(?:https?:\/\/|tg:\/\/|www\.)[^\s"'<>]+/gi, "[ссылка]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[скрыто]")
    .replace(/\b(?:sb_(?:secret|publishable)_[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+|\d{6,12}:[\w-]{30,})\b/g, "[скрыто]")
    .replace(/(?:\b(?:token|access_token|refresh_token|authorization|apikey|api_key|password)|пароль|токен)\s*[:=]\s*(?:(?:Bearer\s+)?[^\s,;]+)/gi, "[скрыто]")
    .replace(/\s+/g, " ").trim();
  // Count Unicode code points, never split a surrogate pair; the ellipsis is inside the limit.
  const characters = Array.from(text);
  return characters.length > limit ? characters.slice(0, limit - 1).join("") + "…" : text;
}

export function createTicketNotice(input: Omit<TicketNotice, "preview"> & {description: string}): TicketNotice {
  const name = noticeText(input.displayName ?? "", 60);
  // Explicit allowlist: do not carry the body, email, auth metadata or arbitrary form fields.
  return {
    id: input.id, category: input.category, createdAt: input.createdAt,
    title: noticeText(input.title, 120),
    preview: noticeText(input.description, TELEGRAM_PREVIEW_LIMIT),
    displayName: name.includes("[скрыто]") || name.includes("[ссылка]") ? null : name || null,
  };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Russian is the configured admin audience, independent of the student's UI language. */
export function formatTicketNotice(ticket: TicketNotice, origin: string): string {
  if (!uuid.safeParse(ticket.id).success) throw new Error("Invalid ticket reference");
  // Reapply bounds at the final transport boundary, including callers other than the action.
  const safe = createTicketNotice({...ticket, description: ticket.preview});
  const t = v05Copy("ru");
  const category = Object.prototype.hasOwnProperty.call(t.categories, safe.category) ? t.categories[safe.category] : t.categories.other;
  const timestamp = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Oral", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(safe.createdAt));
  // No separate /admin/tickets/[id] route exists. The shared detail page renders
  // admin moderation controls from the authenticated role; never invent a broken URL.
  const url = origin + "/support/" + safe.id;
  return [
    "<b>NIS Hub · Новый тикет</b>",
    "<b>Категория:</b> " + escapeHtml(category),
    "<b>Тема:</b> " + escapeHtml(safe.title),
    "<b>Сообщение (превью):</b> " + escapeHtml(safe.preview),
    ...(safe.displayName ? ["<b>Автор:</b> " + escapeHtml(safe.displayName)] : []),
    "<b>Время:</b> " + escapeHtml(timestamp) + " (Asia/Oral)",
    '<a href="' + escapeHtml(url) + '">Открыть тикет в NIS Hub</a>',
  ].join("\n");
}
