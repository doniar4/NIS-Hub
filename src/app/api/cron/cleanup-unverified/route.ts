import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Fallback for Supabase pg_cron: Vercel Cron calls this daily with
// `Authorization: Bearer $CRON_SECRET`. Removes "Waiting for verification"
// accounts older than 3 days through a service-role-only RPC.
export const dynamic = "force-dynamic";

function privilegedKey(key: string) {
  if (/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key)) return true;
  if (key.split(".").length !== 3) return false;
  try { return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "service_role"; }
  catch { return false; }
}

function sameSecret(received: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(received).digest(), createHash("sha256").update(expected).digest());
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const header = request.headers.get("authorization") ?? "";
  if (secret.length < 16 || !header.startsWith("Bearer ") || !sameSecret(header.slice(7), secret))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !privilegedKey(key))
    return Response.json({ error: "Service role is not configured" }, { status: 503 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("cleanup_unverified_accounts_job");
  if (error) return Response.json({ error: "Cleanup failed" }, { status: 500 });
  return Response.json({ removed: data ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
