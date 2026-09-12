import { createClient } from "@/lib/supabase/server";
import { canReadBook, pdfPathSchema, uuid } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  const { id } = await params;
  if (!uuid.safeParse(id).success) return Response.json({ error: "Материал не найден." }, { status: 404, headers });
  const supabase = await createClient(true);
  if (!supabase) return Response.json({ error: "Сервис ещё не подключён." }, { status: 503, headers });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Войдите в аккаунт." }, { status: 401, headers });
  const { data: book, error } = await supabase.from("books").select("file_path,publication_status").eq("id", id).maybeSingle();
  if (error) return Response.json({ error: "Не удалось проверить доступ." }, { status: 503, headers });
  if (!book || !canReadBook(book) || !pdfPathSchema.safeParse(book.file_path).success) return Response.json({ error: "Материал недоступен." }, { status: 404, headers });
  const { data, error: storageError } = await supabase.storage.from("book-files").createSignedUrl(book.file_path, 60);
  if (storageError || !data) return Response.json({ error: "Файл сейчас недоступен." }, { status: 503, headers });
  return Response.json({ url: data.signedUrl, expiresIn: 60 }, { headers });
}
