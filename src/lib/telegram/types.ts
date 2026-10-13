import { z } from "zod";
import type { TelegramHomeworkSession } from "@/lib/database.types";

const positiveId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const chat = z.object({ id: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER), type: z.string() });
const message = z.object({ from: z.object({ id: positiveId, is_bot: z.boolean().optional() }), chat, text: z.string().max(8192).optional() });
const update = z.object({
  update_id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  message: message.optional(),
  callback_query: z.object({ id: z.string().min(1).max(256), from: z.object({ id: positiveId, is_bot: z.boolean().optional() }),
    message: z.object({ chat }).optional(), data: z.string().max(256).optional() }).optional(),
});
export type Incoming = { updateId: number; userId: number; chatId: number; privateChat: boolean; callbackId?: string; data?: string; text?: string };
export function parseUpdate(raw: unknown): Incoming | null {
  const parsed = update.safeParse(raw);
  if (!parsed.success) throw new Error("invalid_payload");
  const u = parsed.data;
  if (u.callback_query) {
    const c = u.callback_query;
    if (!c.message || c.from.is_bot) return null;
    return { updateId: u.update_id, userId: c.from.id, chatId: c.message.chat.id,
      privateChat: c.message.chat.type === "private" && c.message.chat.id === c.from.id, callbackId: c.id, data: c.data };
  }
  if (!u.message || u.message.from.is_bot) return null;
  const m = u.message;
  return { updateId: u.update_id, userId: m.from.id, chatId: m.chat.id,
    privateChat: m.chat.type === "private" && m.chat.id === m.from.id, text: m.text };
}
export type Action = { action: "start" | "add" | "cancel" | "grade" | "class" | "subject" | "date" | "body" | "publish" | "edit" | "inline_cancel"; value: string | null; token: string | null };
export function parseAction(input: Incoming): Action | null {
  if (input.callbackId) {
    if (!input.data || Buffer.byteLength(input.data, "utf8") > 64) return null;
    const [kind, value, token, extra] = input.data.split(":");
    if (extra !== undefined || !/^[0-9a-f]{12}$/.test(token ?? "")) return null;
    if (kind === "grade" && /^(7|8|9|10|11|12)$/.test(value)) return { action: "grade", value, token };
    if ((kind === "class" || kind === "subject") && z.uuid().safeParse(value).success) return { action: kind, value, token };
    if (kind === "date" && ["today", "tomorrow", "dayafter"].includes(value)) return { action: "date", value, token };
    if (kind === "confirm" && ["publish", "edit", "cancel"].includes(value)) return { action: value === "cancel" ? "inline_cancel" : value as "publish" | "edit", value: null, token };
    return null;
  }
  if (input.text === undefined) return null;
  const text = input.text.trim();
  // Telegram may suffix commands with the bot username. No commands with spaces/emoji.
  if (/^\/start(?:@[A-Za-z0-9_]+)?$/.test(text)) return { action: "start", value: null, token: null };
  if (/^\/addhomework(?:@[A-Za-z0-9_]+)?$/.test(text) || text === "📚 Добавить ДЗ") return { action: "add", value: null, token: null };
  if (/^\/cancel(?:@[A-Za-z0-9_]+)?$/.test(text)) return { action: "cancel", value: null, token: null };
  return { action: "body", value: text, token: null };
}
export const sessionSchema = z.object({
  telegram_user_id: positiveId, step: z.enum(["grade", "class", "subject", "date", "body", "confirm"]),
  grade: z.number().int().min(7).max(12).nullable(), class_id: z.uuid().nullable(), subject_id: z.uuid().nullable(),
  due_date: z.iso.date().nullable(), body: z.string().min(1).max(1000).nullable(), token: z.string().regex(/^[0-9a-f]{12}$/),
  last_update_id: z.number().int().nonnegative(), updated_at: z.iso.datetime({ offset: true }), expires_at: z.iso.datetime({ offset: true }),
}) satisfies z.ZodType<TelegramHomeworkSession>;
export type HomeworkClass = { id: string; name: string; grade: number; section: string | null };
export type HomeworkSubject = { id: string; name: string; name_ru: string | null };
export type Reply = { text: string; reply_markup?: { inline_keyboard: { text: string; callback_data: string }[][] } | { keyboard: { text: string }[][]; resize_keyboard: boolean } };
export type HomeworkStore = {
  apply(input: Incoming, action: Action): Promise<string>;
  session(userId: number): Promise<TelegramHomeworkSession | null>;
  classes(grade: number): Promise<HomeworkClass[]>;
  subjects(classId: string): Promise<HomeworkSubject[]>;
};
