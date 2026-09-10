"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/env";
import type { Database } from "@/lib/database.types";

export function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Подключение к аккаунтам пока не настроено.");
  return createBrowserClient<Database>(config.url, config.key);
}
