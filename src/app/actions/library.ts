"use server";
import { actionContext } from "@/lib/auth";
import { uuid } from "@/lib/validation";

export async function changeLibrary(input: {
  kind: "search" | "recent" | "clear";
  bookId?: string;
  name?: string;
}) {
  try {
    const { supabase: db, user } = await actionContext();
    const { kind, bookId } = input;
    if (!["search", "recent", "clear"].includes(kind))
      throw new Error("Invalid action");
    if (kind === "recent" && !uuid.safeParse(bookId).success)
      throw new Error("Invalid book");
    const name = input.name?.trim() ?? "";
    if (kind === "search" && (!name || name.length > 100))
      throw new Error("Invalid name");
    if (bookId && kind === "recent") {
      const { data, error } = await db
        .from("book_variants")
        .select("id")
        .eq("book_id", bookId)
        .eq("publication_status", "published")
        .limit(1);
      if (error || !data?.length) throw new Error("Book unavailable");
    }
    let error: unknown;
    if (kind === "search")
      ({ error } = await db
        .from("library_search_history")
        .upsert(
          {
            user_id: user.id,
            query: name,
            searched_at: new Date().toISOString(),
          },
          { onConflict: "user_id,query" },
        ));
    if (kind === "recent")
      ({ error } = await db
        .from("library_recent_books")
        .upsert(
          {
            user_id: user.id,
            book_id: bookId!,
            opened_at: new Date().toISOString(),
          },
          { onConflict: "user_id,book_id" },
        ));
    if (kind === "clear") {
      const results = await Promise.all([
        db.from("library_search_history").delete().eq("user_id", user.id),
        db.from("library_recent_books").delete().eq("user_id", user.id),
      ]);
      error = results.find((r) => r.error)?.error;
    }
    if (error) throw error;
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error: "Не удалось сохранить изменение. Повторите попытку.",
    };
  }
}
