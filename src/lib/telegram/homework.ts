import "server-only";
import { parseAction, type HomeworkStore, type Incoming, type Reply } from "./types";

export const expiredMessage = "Сессия устарела. Начните снова через /addhomework.";
const addLabel = "📚 Добавить ДЗ";
const button = (text: string, action: string, value: string, token: string) => ({ text, callback_data: `${action}:${value}:${token}` });
const inline = (rows: { text: string; callback_data: string }[][], token: string): Reply["reply_markup"] => ({
  inline_keyboard: [...rows, [button("❌ Отмена", "confirm", "cancel", token)]],
});
function grouped<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
export function oralDate(offset: 0 | 1 | 2, now = new Date()): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Oral", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const result = new Date(`${day}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}
export async function homeworkReply(outcome: string, userId: number, store: HomeworkStore): Promise<Reply> {
  if (outcome === "welcome") return { text: "NIS Hub · Домашние задания", reply_markup: { keyboard: [[{ text: addLabel }]], resize_keyboard: true } };
  if (outcome === "published") return { text: "✅ Домашнее задание добавлено в NIS Hub." };
  if (outcome === "cancelled") return { text: "❌ Добавление ДЗ отменено." };
  if (outcome === "rate_limited") return { text: "⏳ Слишком много добавлений за сегодня. Попробуйте позже." };
  if (outcome === "invalid") return { text: expiredMessage };
  const s = await store.session(userId);
  if (!s || Date.parse(s.expires_at) <= Date.now()) return { text: expiredMessage };
  // On retry, reflect the current draft; never apply an older state transition again.
  switch (s.step) {
    case "grade": return { text: "Выберите параллель:", reply_markup: inline(grouped([7, 8, 9, 10, 11, 12].map(g => button(String(g), "grade", String(g), s.token)), 3), s.token) };
    case "class": {
      if (!s.grade) return { text: expiredMessage };
      const classes = await store.classes(s.grade);
      if (classes.length > 90) throw new Error("keyboard_limit");
      return { text: classes.length ? "Выберите класс:" : "В этой параллели пока нет классов. Начните снова через /addhomework.",
        reply_markup: inline(grouped(classes.map(c => button(c.name.slice(0, 80), "class", c.id, s.token)), 3), s.token) };
    }
    case "subject": {
      if (!s.class_id) return { text: expiredMessage };
      const subjects = await store.subjects(s.class_id);
      if (subjects.length > 90) throw new Error("keyboard_limit");
      return { text: subjects.length ? "Выберите предмет:" : "В расписании этого класса пока нет предметов.",
        reply_markup: inline(grouped(subjects.map(sub => button((sub.name_ru?.trim() || sub.name).slice(0, 120), "subject", sub.id, s.token)), 2), s.token) };
    }
    case "date": return { text: "📅 На какую дату задать?", reply_markup: inline([[
      button("Сегодня", "date", "today", s.token), button("Завтра", "date", "tomorrow", s.token), button("Послезавтра", "date", "dayafter", s.token),
    ]], s.token) };
    case "body": return { text: outcome === "body_invalid" ? "Введите домашнее задание: от 1 до 1000 символов после удаления пробелов по краям." : "✏️ Напишите домашнее задание.", reply_markup: inline([], s.token) };
    case "confirm": {
      if (!s.grade || !s.class_id || !s.subject_id || !s.due_date || !s.body) return { text: expiredMessage };
      const [classes, subjects] = await Promise.all([store.classes(s.grade), store.subjects(s.class_id)]);
      const c = classes.find(c => c.id === s.class_id), sub = subjects.find(sub => sub.id === s.subject_id);
      if (!c || !sub) return { text: expiredMessage };
      const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Oral" }).format(new Date(`${s.due_date}T12:00:00Z`));
      return { text: `📚 Новое домашнее задание\n\nКласс: ${c.name.slice(0, 80)}\nПредмет: ${(sub.name_ru?.trim() || sub.name).slice(0, 120)}\nДата: ${date}\n\nДЗ:\n${s.body}`,
        reply_markup: inline([[button("✅ Опубликовать", "confirm", "publish", s.token), button("✏️ Изменить", "confirm", "edit", s.token)]], s.token) };
    }
  }
}

export type BotApi = { answer(id: string): Promise<boolean>; send(chatId: number, reply: Reply): Promise<boolean> };
export async function handleHomework(input: Incoming, store: HomeworkStore, api: BotApi): Promise<"ok" | "retry"> {
  // Do this before any database IO, including non-private/expired callbacks.
  if (input.callbackId) await api.answer(input.callbackId);
  if (!input.privateChat) {
    return await api.send(input.chatId, { text: "Используйте бота в личном чате." }) ? "ok" : "retry";
  }
  const action = parseAction(input);
  if (!action) return await api.send(input.chatId, { text: expiredMessage }) ? "ok" : "retry";
  // Match website z.string().trim().min(1).max(1000) including JS length semantics.
  if (action.action === "body" && (action.value === null || action.value.length < 1 || action.value.length > 1000)) action.value = null;
  try {
    const outcome = await store.apply(input, action);
    const reply = await homeworkReply(outcome, input.userId, store);
    return await api.send(input.chatId, reply) ? "ok" : "retry";
  } catch {
    console.warn("telegram_homework", { category: "database", code: "operation_failed" });
    await api.send(input.chatId, { text: "⚠️ Не удалось добавить ДЗ. Попробуйте ещё раз." });
    // Retry with same update_id is safe even if mutation committed but rendering failed.
    return "retry";
  }
}
