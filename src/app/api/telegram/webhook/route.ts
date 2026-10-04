import { homeworkStore } from "@/lib/telegram/database";
import { telegramApi } from "@/lib/telegram/api";
import { handleHomework } from "@/lib/telegram/homework";
import { readBoundedJson, readTelegramConfig, validWebhookSecret } from "@/lib/telegram/security";
import { parseUpdate } from "@/lib/telegram/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const response = (status: number) => new Response(status === 200 ? "ok" : "unavailable", { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const config = readTelegramConfig();
  if (!config) {
    console.warn("telegram_homework", { category: "configuration", code: "missing_or_invalid" });
    return response(503);
  }
  if (!validWebhookSecret(request.headers.get("X-Telegram-Bot-Api-Secret-Token"), config.secret)) return response(401);
  let input;
  try { input = parseUpdate(await readBoundedJson(request.body, 32768)); }
  catch { return response(400); }
  if (!input) return response(200);
  // Service-role client is server-only and has no access to browser cookies/tokens.
  const outcome = await handleHomework(input, homeworkStore(config), telegramApi(config.token));
  if (outcome === "retry") console.warn("telegram_homework", { category: "delivery", code: "retry_required" });
  return response(outcome === "ok" ? 200 : 503);
}
