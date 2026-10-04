import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export type TelegramConfig = {
  token: string; secret: string; admins: ReadonlySet<number>; authorId: string;
  supabaseUrl: string; serviceKey: string;
};

export function readTelegramConfig(env: Readonly<Record<string, string | undefined>> = process.env): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN ?? "";
  const secret = env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const authorId = env.TELEGRAM_HOMEWORK_AUTHOR_ID ?? "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const rawIds = (env.TELEGRAM_ADMIN_IDS ?? "").split(",").map(s => s.trim());
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token) || !/^[A-Za-z0-9_-]{32,256}$/.test(secret)
    || !z.uuid().safeParse(authorId).success || rawIds.length > 100
    || rawIds.some(s => !/^[1-9]\d*$/.test(s) || !Number.isSafeInteger(Number(s)))) return null;
  // Reject public/publishable keys. This client must NEVER inherit a browser session.
  let privileged = /^sb_secret_[A-Za-z0-9_-]{20,}$/.test(serviceKey);
  if (!privileged && serviceKey.split(".").length === 3) {
    try { privileged = JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64url").toString()).role === "service_role"; }
    catch { return null; }
  }
  if (!privileged) return null;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return { token, secret, authorId, serviceKey, supabaseUrl: url.origin, admins: new Set(rawIds.map(Number)) };
  } catch { return null; }
}

export function validWebhookSecret(received: string | null, expected: string): boolean {
  if (!received || received.length > 256) return false;
  return timingSafeEqual(createHash("sha256").update(received).digest(), createHash("sha256").update(expected).digest());
}

// Bounded streaming, including chunked requests; never log the body or exception.
export async function readBoundedJson(body: ReadableStream<Uint8Array> | null, maxBytes: number, timeoutMs = 5000): Promise<unknown> {
  if (!body) throw new Error("invalid_payload");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, timeoutMs);
  let complete = false;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) { complete = true; break; }
      size += part.value.byteLength;
      if (size > maxBytes) throw new Error("payload_limit");
      chunks.push(part.value);
    }
    if (timedOut) throw new Error("payload_timeout");
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    clearTimeout(timer);
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
