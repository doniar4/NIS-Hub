export const AVATAR_URL_TTL_SECONDS = 60;
export function avatarCooldownRemaining(updatedAt: string | null | undefined, now = Date.now()): number {
  if (!updatedAt) return 0;
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.min(60, Math.max(0, Math.ceil((timestamp + 60_000 - now) / 1000)));
}
