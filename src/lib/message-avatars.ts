import type { DmThread } from "./database.types";

const TTL_SECONDS = 600;
const urls = new Map<string, { url: string; expires: number }>();

/** The inbox RPC authorizes peers before any cached URL can be returned. */
export async function withMessageAvatars(
  rows: DmThread[],
  sign: (
    paths: string[],
    ttl: number,
  ) => Promise<{
    data:
      | {
          path?: string | null;
          signedUrl: string | null;
          error?: string | null;
        }[]
      | null;
  }>,
  now = Date.now(),
): Promise<DmThread[]> {
  for (const [key, entry] of urls) if (entry.expires <= now) urls.delete(key);
  const keyFor = (row: DmThread) =>
    `${row.peer_avatar_path}:${row.peer_avatar_updated_at}`;
  const allowed = rows.filter(
    (row) =>
      !row.blocked && row.peer_avatar_path === `${row.peer_id}/avatar.webp`,
  );
  const missing = allowed.filter((row) => !urls.has(keyFor(row)));
  if (missing.length) {
    try {
      const result = await sign(
        [...new Set(missing.map((row) => row.peer_avatar_path!))],
        TTL_SECONDS,
      );
      for (const item of result.data ?? []) {
        if (item.error || !item.signedUrl) continue;
        for (const row of missing.filter(
          (row) => row.peer_avatar_path === item.path,
        )) {
          if (urls.size >= 1000) urls.delete(urls.keys().next().value!);
          urls.set(keyFor(row), {
            url: item.signedUrl,
            expires: now + (TTL_SECONDS - 60) * 1000,
          });
        }
      }
    } catch {
      /* An image failure must not prevent reading messages. */
    }
  }
  return rows.map((row) => ({
    ...row,
    peer_avatar_url: allowed.includes(row)
      ? (urls.get(keyFor(row))?.url ?? null)
      : null,
  }));
}
