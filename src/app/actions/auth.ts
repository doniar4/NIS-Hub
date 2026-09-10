"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, safeNext } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

export async function authenticate(mode: "login" | "signup", _state: ActionState, form: FormData): Promise<ActionState> {
  if (mode !== "login" && mode !== "signup") return { error: "Неизвестное действие." };
  const parsed = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (mode === "signup" && form.get("terms") !== "on") return { error: "Ознакомьтесь с условиями и политикой конфиденциальности." };
  try {
    const supabase = await createClient(true);
    if (!supabase) return { error: "Сервис входа ещё не подключён." };
    const result = mode === "signup"
      ? await supabase.auth.signUp(parsed.data)
      : await supabase.auth.signInWithPassword(parsed.data);
    if (result.error) {
      if (result.error.status === 429) return { error: "Слишком много попыток. Подождите и попробуйте снова." };
      if (result.error.code === "email_not_confirmed") return { error: "Подтвердите email по ссылке из письма." };
      return { error: mode === "login" ? "Не удалось войти. Проверьте email и пароль." : "Не удалось зарегистрироваться. Проверьте email и требования к паролю." };
    }
    if (mode === "signup" && !result.data.session) return { success: "Проверьте почту: если регистрация доступна, вы получите письмо для подтверждения email." };
  } catch {
    return { error: "Сервис входа временно недоступен. Попробуйте позже." };
  }
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next")));
}

export async function logout(_state: ActionState, _form: FormData): Promise<ActionState> {
  void _state; void _form;
  const supabase = await createClient(true);
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { error: "Не удалось выйти. Повторите попытку." };
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
