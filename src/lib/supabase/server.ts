import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "@/lib/env";
import type { Database } from "@/lib/database.types";

export async function createClient(writable = false) {
  const config = getSupabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        // Rendering cannot write cookies. Proxy refreshes before rendering;
        // actions/callbacks explicitly opt into writes and propagate failures.
        if (writable) for (const { name, value, options } of values) store.set(name, value, options);
      },
    },
  });
}
