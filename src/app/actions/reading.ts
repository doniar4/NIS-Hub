"use server";
import { getI18n } from "@/lib/i18n-server";
import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/auth";
import { canReadBook, pageSchema, uuid } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
export async function saveReading(bookId: string, page: number, mode: "progress" | "bookmark" | "remove", variantId: string = bookId): Promise<ActionState> {
    const { t } = await getI18n();
    if (!uuid.safeParse(bookId).success || !uuid.safeParse(variantId).success || !pageSchema.safeParse(page).success || !["progress", "bookmark", "remove"].includes(mode))
        return { error: t.invalidInput };
    try {
        const { supabase, user } = await actionContext();
        // Removal stays possible after a material is unpublished.
        if (mode === "remove") {
            const { error } = await supabase.from("variant_bookmarks").delete().eq("profile_id", user.id).eq("book_variant_id", variantId).eq("page_number", page);
            if (error)
                return { error: t.saveError };
        }
        else {
            const { data: book, error } = await supabase.from("book_variants").select("publication_status,page_count").eq("id", variantId).eq("book_id", bookId).maybeSingle();
            if (error || !book || !canReadBook(book) || (book.page_count && page > book.page_count))
                return { error: t.unavailableBook };
            const value = { profile_id: user.id, book_variant_id: variantId, page_number: page };
            const result = mode === "progress"
                ? await supabase.from("variant_reading_progress").upsert(value, { onConflict: "profile_id,book_variant_id" })
                : await supabase.from("variant_bookmarks").upsert(value, { onConflict: "profile_id,book_variant_id,page_number", ignoreDuplicates: true });
            if (result.error)
                return { error: t.saveError };
        }
    }
    catch {
        return { error: t.sessionError };
    }
    revalidatePath("/profile");
    revalidatePath("/");
    return { success: mode === "progress" ? t.positionSaved : mode === "remove" ? t.bookmarkRemoved : t.bookmarkSaved };
}
