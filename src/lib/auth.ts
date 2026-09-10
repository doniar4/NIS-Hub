import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/validation";

export const getViewer = cache(async () => {
  const supabase = await createClient();
  if (!supabase) return { configured: false as const, user: null, profile: null };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.status && error.status >= 500) throw new Error("Не удалось проверить вход. Повторите попытку.");
  if (!user) return { configured: true as const, user: null, profile: null };
  const result = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (result.error) throw new Error("Не удалось загрузить профиль. Проверьте подключение базы.");
  return { configured: true as const, user, profile: result.data };
});

export async function requireViewer(path: string) {
  const viewer = await getViewer();
  if (!viewer.configured) redirect("/setup");
  if (!viewer.user) redirect(`/login?next=${encodeURIComponent(safeNext(path))}`);
  if (!viewer.profile) throw new Error("Профиль не создан. Администратору необходимо применить миграцию базы.");
  return { user: viewer.user, profile: viewer.profile };
}

export async function requireAdmin() {
  const viewer = await requireViewer("/admin");
  if (viewer.profile.role !== "admin") redirect("/forbidden");
  return viewer;
}

export async function actionContext(admin = false) {
  const supabase = await createClient(true);
  if (!supabase) throw new Error("Сервис ещё не подключён.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Войдите в аккаунт и повторите действие.");
  if (admin) {
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileError || profile.role !== "admin") throw new Error("Это действие доступно только администратору.");
  }
  return { supabase, user };
}
