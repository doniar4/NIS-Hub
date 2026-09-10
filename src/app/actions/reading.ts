"use server";
import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/auth";
import { canReadBook, pageSchema, uuid } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

export async function saveReading(bookId: string, page: number, mode: "progress" | "bookmark" | "remove"): Promise<ActionState> {
  if (!uuid.safeParse(bookId).success || !pageSchema.safeParse(page).success || !["progress", "bookmark", "remove"].includes(mode)) return { error: "Некорректная страница или книга." };
  try {
    const { supabase, user } = await actionContext();
    // Removal stays possible after a material is unpublished.
    if (mode === "remove") {
      const { error } = await supabase.from("bookmarks").delete().eq("profile_id", user.id).eq("book_id", bookId).eq("page_number", page);
      if (error) return { error: "Не удалось удалить закладку." };
    } else {
      const { data: book, error } = await supabase.from("books").select("publication_status,license_status,page_count").eq("id", bookId).maybeSingle();
      if (error || !book || !canReadBook(book) || (book.page_count && page > book.page_count)) return { error: "Эта книга или страница недоступна." };
      const value = { profile_id: user.id, book_id: bookId, page_number: page };
      const result = mode === "progress"
        ? await supabase.from("reading_progress").upsert(value, { onConflict: "profile_id,book_id" })
        : await supabase.from("bookmarks").upsert(value, { onConflict: "profile_id,book_id,page_number", ignoreDuplicates: true });
      if (result.error) return { error: "Не удалось сохранить страницу. Проверьте подключение." };
    }
  } catch { return { error: "Сессия недоступна. Войдите снова." }; }
  revalidatePath("/profile"); revalidatePath("/");
  return { success: mode === "progress" ? "Позиция сохранена." : mode === "remove" ? "Закладка удалена." : "Закладка сохранена." };
}
