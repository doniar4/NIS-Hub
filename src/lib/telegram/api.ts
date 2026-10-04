import "server-only";
import { readBoundedJson } from "./security";
import type { Reply } from "./types";

export function telegramApi(token: string) {
  async function call(method: "sendMessage" | "answerCallbackQuery", payload: object, timeoutMs: number) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs), cache: "no-store", redirect: "error",
      });
      if (!response.ok) { await response.body?.cancel(); return false; }
      const data = await readBoundedJson(response.body, 64000, timeoutMs);
      return typeof data === "object" && data !== null && "ok" in data && data.ok === true;
    } catch { return false; }
  }
  return {
    // Plain text: no HTML/Markdown parsing of untrusted homework or database labels.
    send: (chatId: number, reply: Reply) => call("sendMessage", { chat_id: chatId, ...reply, link_preview_options: { is_disabled: true } }, 5000),
    answer: (id: string) => call("answerCallbackQuery", { callback_query_id: id }, 2000),
  };
}
