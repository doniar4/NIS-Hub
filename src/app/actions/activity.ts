"use server";
import { actionContext } from "@/lib/auth";

export type ActivityItem = {
  id: string;
  user_id: string | null;
  user_name?: string;
  path: string;
  user_agent: string | null;
  created_at: string;
};

export type AdminActivityStats = {
  onlineCount: number;
  todayCount: number;
  totalHitsToday: number;
  recent: ActivityItem[];
};

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

export async function getAdminActivityStats(): Promise<AdminActivityStats | null> {
  try {
    const { supabase } = await actionContext(true);
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const [onlineRes, todayRes, totalRes, recentRes] = await Promise.all([
      supabase
        .from("user_activity_logs")
        .select("user_id")
        .gte("created_at", fifteenMinAgo)
        .not("user_id", "is", null),
      supabase
        .from("user_activity_logs")
        .select("user_id")
        .gte("created_at", todayIso)
        .not("user_id", "is", null),
      supabase
        .from("user_activity_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayIso),
      supabase
        .from("user_activity_logs")
        .select("id, user_id, path, user_agent, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    if (onlineRes.error || todayRes.error || recentRes.error) {
      return null;
    }

    const onlineSet = new Set((onlineRes.data ?? []).map((r) => r.user_id));
    const todaySet = new Set((todayRes.data ?? []).map((r) => r.user_id));

    const userIds = Array.from(
      new Set((recentRes.data ?? []).map((r) => r.user_id).filter(Boolean)),
    ) as string[];

    const nameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const profilesRes = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      if (profilesRes.data) {
        for (const p of profilesRes.data) {
          nameMap[p.id] = p.display_name || "Пользователь";
        }
      }
    }

    const recent: ActivityItem[] = (recentRes.data ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_id ? nameMap[row.user_id] ?? "Ученик" : "Гость",
      path: row.path,
      user_agent: row.user_agent,
      created_at: row.created_at,
    }));

    return {
      onlineCount: onlineSet.size,
      todayCount: todaySet.size,
      totalHitsToday: totalRes.count ?? 0,
      recent,
    };
  } catch {
    return null;
  }
}
