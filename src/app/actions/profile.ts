"use server";
import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/auth";
import { profileSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

export async function saveProfile(_state: ActionState, form: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse({ display_name: form.get("display_name"), class_id: form.get("class_id"), subjects: form.getAll("subjects").filter(Boolean) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const { supabase } = await actionContext();
    const { error } = await supabase.rpc("save_profile", { p_name: parsed.data.display_name, p_class: parsed.data.class_id, p_subjects: parsed.data.subjects });
    if (error) return { error: "Не удалось сохранить профиль. Проверьте класс и предметы и повторите попытку." };
  } catch { return { error: "Войдите в аккаунт и попробуйте сохранить ещё раз." }; }
  revalidatePath("/profile"); revalidatePath("/");
  return { success: "Профиль сохранён." };
}
