const PRODUCTION_ORIGIN = "https://nis-hub-ura.vercel.app";

/** One trusted origin for auth redirects, metadata and generated public URLs. */
export function getSiteOrigin(
  configured = process.env.NEXT_PUBLIC_SITE_URL,
  environment = process.env.NODE_ENV,
): string {
  const value = configured?.trim() || (environment === "production" ? PRODUCTION_ORIGIN : "http://localhost:3000");
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (
    (url.protocol !== "https:" && !(environment !== "production" && local && url.protocol === "http:")) ||
    url.username || url.password || url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTPS origin (localhost HTTP only in development).");
  }
  return url.origin;
}

export function absoluteSiteUrl(path: string): string {
  const origin = getSiteOrigin();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Expected a local absolute path.");
  }
  const url = new URL(path, origin);
  if (url.origin !== origin) throw new Error("Expected a local absolute path.");
  return url.toString();
}

export const authCallbackUrl = () => absoluteSiteUrl("/auth/callback");
