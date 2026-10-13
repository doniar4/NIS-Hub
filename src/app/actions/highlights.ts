"use server";
import { actionContext } from "@/lib/auth";
import {
  highlightSchema,
  parseHighlights,
  type Highlight,
} from "@/lib/pdf-highlights";
import { uuid } from "@/lib/validation";
export async function getHighlights(variantId: string) {
  if (!uuid.safeParse(variantId).success) return { ok: false as const };
  try {
    const { supabase, user } = await actionContext();
    const { data, error } = await supabase
      .from("book_highlights")
      .select("id,page_number,color,rects")
      .eq("user_id", user.id)
      .eq("book_variant_id", variantId)
      .order("created_at")
      .limit(2000);
    if (error) throw error;
    return {
      ok: true as const,
      userId: user.id,
      highlights: parseHighlights(
        data.map((row) => ({
          ...(row.rects &&
          typeof row.rects === "object" &&
          !Array.isArray(row.rects)
            ? row.rects
            : {}),
          id: row.id,
          page: row.page_number,
          color: row.color,
        })),
      ),
    };
  } catch {
    return { ok: false as const };
  }
}
export async function saveHighlight(variantId: string, highlight: Highlight) {
  const parsed = highlightSchema.safeParse(highlight);
  if (!uuid.safeParse(variantId).success || !parsed.success)
    return { ok: false };
  try {
    const { supabase, user } = await actionContext();
    const { data: variant, error: readError } = await supabase
      .from("book_variants")
      .select("id,page_count")
      .eq("id", variantId)
      .eq("publication_status", "published")
      .maybeSingle();
    if (
      readError ||
      !variant ||
      (variant.page_count && parsed.data.page > variant.page_count)
    )
      return { ok: false };
    const h = parsed.data;
    const { error } = await supabase
      .from("book_highlights")
      .upsert(
        {
          id: h.id,
          user_id: user.id,
          book_variant_id: variantId,
          page_number: h.page,
          color: h.color,
          rects: { x: h.x, y: h.y, w: h.w, h: h.h },
        },
        { onConflict: "id" },
      );
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
export async function deleteHighlight(variantId: string, id: string) {
  if (!uuid.safeParse(variantId).success || !uuid.safeParse(id).success)
    return { ok: false };
  try {
    const { supabase, user } = await actionContext();
    const { error } = await supabase
      .from("book_highlights")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("book_variant_id", variantId);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
