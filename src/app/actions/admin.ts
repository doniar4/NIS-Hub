"use server";
import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/auth";
import { adminEntitySchema, bookSchema, classSchema, lessonSchema, subjectSchema, uuid } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

export async function saveAdminRecord(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { supabase } = await actionContext(true);
    const entity = adminEntitySchema.safeParse(form.get("entity"));
    if (!entity.success) return { error: "Неизвестный раздел." };
    const raw = Object.fromEntries(form);
    let error: { code?: string; message: string } | null = null;
    if (entity.data === "books") {
      const parsed = bookSchema.safeParse(raw);
      if (!parsed.success) return { error: parsed.error.issues[0].message };
      const { source, permission_note, ...book } = parsed.data;
      if (book.publication_status === "published" && form.get("confirm_rights") !== "on") return { error: "Подтвердите, что права на размещение проверены." };
      ({ error } = await supabase.rpc("save_book", { p_book: book, p_source: source, p_note: permission_note }));
    } else if (entity.data === "classes") {
      const parsed = classSchema.safeParse(raw);
      if (!parsed.success) return { error: parsed.error.issues[0].message };
      const { id, ...data } = parsed.data;
      ({ error } = id ? await supabase.from("classes").update(data).eq("id", id) : await supabase.from("classes").insert(data));
    } else if (entity.data === "subjects") {
      const parsed = subjectSchema.safeParse(raw);
      if (!parsed.success) return { error: parsed.error.issues[0].message };
      const { id, ...data } = parsed.data;
      ({ error } = id ? await supabase.from("subjects").update(data).eq("id", id) : await supabase.from("subjects").insert(data));
    } else {
      const parsed = lessonSchema.safeParse(raw);
      if (!parsed.success) return { error: parsed.error.issues[0].message };
      const { id, ...data } = parsed.data;
      ({ error } = id ? await supabase.from("schedule").update(data).eq("id", id) : await supabase.from("schedule").insert(data));
    }
    if (error) return { error: error.code === "23505" ? "Такая запись уже существует." : "Запись не сохранена. Проверьте поля, связи и права доступа." };
  } catch { return { error: "Для этого действия требуется активная сессия администратора." }; }
  revalidatePath("/", "layout");
  return { success: "Запись сохранена." };
}

export async function deleteAdminRecord(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { supabase } = await actionContext(true);
    const entity = adminEntitySchema.safeParse(form.get("entity"));
    const id = uuid.safeParse(form.get("id"));
    if (!entity.success || !id.success || form.get("confirm_delete") !== "on") return { error: "Подтвердите удаление конкретной записи." };
    // Books are archived recoverably. Reference rows are deleted only when unused
    // (FK restrictions in the Phase 2 migration protect student and schedule data).
    const result = entity.data === "books"
      ? await supabase.from("books").update({ publication_status: "archived" }).eq("id", id.data)
      : await supabase.from(entity.data).delete().eq("id", id.data);
    if (result.error) return { error: "Запись используется в других разделах или недоступна. Сначала измените связанные записи." };
  } catch { return { error: "Для этого действия требуется активная сессия администратора." }; }
  revalidatePath("/", "layout");
  return { success: "Изменение сохранено." };
}
