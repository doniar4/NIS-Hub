export const WELCOME_COOKIE = "nis-welcome-complete";
export const WELCOME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;

export function isWelcomeComplete(value: unknown): boolean {
  return value === "1";
}
