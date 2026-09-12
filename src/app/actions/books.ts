"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { phase4Copy } from "@/lib/phase4-copy";
import { bookSchema, uuid } from "@/lib/validation";
import { BOOK_PDF_BYTES, canonicalBookPath, pdfFileIssue } from "@/lib/book-upload";
import type { ActionState } from "@/lib/action-state";
const fileSchema = z.object({ name: z.string().max(255), type: z.string().max(100), size: z.number().int() });
export async function saveBook(form: FormData, stage: "prepare" | "finish"): Promise<ActionState> {
  const { locale } = await getI18n(); const t = phase4Copy(locale);
  try {
    const { supabase } = await actionContext(true);
    if (!["prepare","finish"].includes(stage)) return { error: t.bookInvalid };
    const id = uuid.safeParse(form.get("id"));
    if (!id.success) return { error: t.bookInvalid };
    const { data: current, error: readError } = await supabase.from("books").select("file_path").eq("id", id.data).maybeSingle();
    if (readError) return { error: t.bookError };
    const uploading = form.get("upload") === "yes";
    if (!current && !uploading) return { error: t.pdfInvalid };
    const path = uploading ? canonicalBookPath(id.data) : current!.file_path;
    const parsed = bookSchema.safeParse({ ...Object.fromEntries(form), file_path: path });
    if (!parsed.success) return { error: t.bookInvalid };
    if (uploading) {
      const file = fileSchema.safeParse({ name: form.get("file_name"), type: form.get("file_type"), size: Number(form.get("file_size")) });
      if (!file.success) return { error: t.pdfInvalid };
      const issue = pdfFileIssue(file.data); if (issue) return { error: t[issue] };
      if (current && form.get("replace") !== "on") return { error: t.bookInvalid };
    }
    const book = parsed.data;
    if (stage === "prepare") {
      if (!uploading) return { error: t.bookInvalid };
      // Metadata first: a failed upload leaves a recoverable referenced draft,
      // not an orphan file. Never delete a file after an ambiguous network result.
      book.publication_status = "draft";
    } else if (book.publication_status === "published" || uploading) {
      const { data, error } = await supabase.storage.from("book-files").info(path);
      if (error || !data || typeof data.size !== "number" || data.size < 5 || data.size > BOOK_PDF_BYTES || data.contentType?.split(";")[0] !== "application/pdf")
        return { error: t.fileMissing };
    }
    const { error } = await supabase.rpc("save_book", { p_book: book });
    if (error) return { error: t.bookError };
  } catch { return { error: t.bookError }; }
  // Prepare must NOT refresh the page mid-upload (new record / input state).
  if (stage === "finish") revalidatePath("/", "layout");
  return { success: t.bookSaved };
}
