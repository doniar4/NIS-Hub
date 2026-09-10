export type SupabaseConfig = { url: string; key: string };

export function parseSupabaseConfig(url?: string, key?: string): SupabaseConfig | null {
  if (!url && !key) return null;
  if (!url || !key) throw new Error("Set both Supabase URL and publishable key in .env.local.");
  const parsed = new URL(url);
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if ((parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("Supabase URL must be an HTTPS origin (HTTP is allowed for local development).");
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    try {
      const parts = key.split(".");
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string };
      if (parts.length !== 3 || payload.role !== "anon") throw new Error();
    } catch {
      throw new Error("Use a publishable or legacy anon key. Privileged keys are rejected.");
    }
  }
  return { url: parsed.origin, key };
}

export function getSupabaseConfig() {
  return parseSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
