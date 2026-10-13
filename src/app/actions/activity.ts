"use server";
import { actionContext } from "@/lib/auth";

export async function recordUserActivity(path: string, userAgent?: string): Promise<{ ok: boolean }> {
  try {
    const { supabase, user } = await actionContext();
    if (!user) return { ok: false };
    const { error } = await supabase.rpc("log_user_activity", {
      p_path: path.slice(0, 255),
      p_user_agent: (userAgent ?? "").slice(0, 255),
    });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
