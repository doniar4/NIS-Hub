"use server";
import { actionContext } from "@/lib/auth";
import { uuid } from "@/lib/validation";

export async function changeLibrary(input: {
  kind:
    | "favorite"
    | "collection"
    | "create"
    | "rename"
    | "delete"
    | "search"
    | "recent"
    | "clear";
  id?: string;
  bookId?: string;
  name?: string;
  enabled?: boolean;
}) {
  try {
    const { supabase: db, user } = await actionContext();
    const { kind, id, bookId } = input;
    if (
      ![
        "favorite",
        "collection",
        "create",
        "rename",
        "delete",
        "search",
        "recent",
        "clear",
      ].includes(kind)
    )
      throw new Error("Invalid action");
    if (
      ["favorite", "collection", "recent"].includes(kind) &&
      !uuid.safeParse(bookId).success
    )
      throw new Error("Invalid book");
    if (
      ["collection", "rename", "delete"].includes(kind) &&
      !uuid.safeParse(id).success
    )
      throw new Error("Invalid collection");
    if (
      ["favorite", "collection"].includes(kind) &&
      typeof input.enabled !== "boolean"
    )
      throw new Error("Invalid state");
    const name = input.name?.trim() ?? "";
    if (
      ["create", "rename", "search"].includes(kind) &&
      (!name || name.length > (kind === "search" ? 100 : 80))
    )
      throw new Error("Invalid name");
    if (bookId && (input.enabled || kind === "recent")) {
      const { data, error } = await db
        .from("book_variants")
        .select("id")
        .eq("book_id", bookId)
        .eq("publication_status", "published")
        .limit(1);
      if (error || !data?.length) throw new Error("Book unavailable");
    }
    let error: unknown;
    if (kind === "favorite")
      ({ error } = input.enabled
        ? await db
            .from("library_favorites")
            .upsert(
              { user_id: user.id, book_id: bookId! },
              { onConflict: "user_id,book_id" },
            )
        : await db
            .from("library_favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("book_id", bookId!));
    if (kind === "collection")
      ({ error } = input.enabled
        ? await db
            .from("library_collection_books")
            .upsert(
              { user_id: user.id, book_id: bookId!, collection_id: id! },
              { onConflict: "collection_id,book_id" },
            )
        : await db
            .from("library_collection_books")
            .delete()
            .eq("user_id", user.id)
            .eq("collection_id", id!)
            .eq("book_id", bookId!));
    if (kind === "create")
      ({ error } = await db
        .from("library_collections")
        .insert({ user_id: user.id, name }));
    if (kind === "rename")
      ({ error } = await db
        .from("library_collections")
        .update({ name })
        .eq("user_id", user.id)
        .eq("id", id!));
    if (kind === "delete")
      ({ error } = await db
        .from("library_collections")
        .delete()
        .eq("user_id", user.id)
        .eq("id", id!));
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
