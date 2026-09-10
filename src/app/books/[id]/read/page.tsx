import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PdfReader } from "@/components/pdf-reader";
import { requireViewer } from "@/lib/auth";
import { database, getBook } from "@/lib/queries";
import { pageSchema } from "@/lib/validation";

export default async function ReadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params;
  const { user } = await requireViewer(`/books/${id}/read`);
  const book = await getBook(id);
  if (!book) notFound();
  const supabase = await database();
  const [progress, bookmarks] = await Promise.all([
    supabase.from("reading_progress").select("page_number").eq("profile_id", user.id).eq("book_id", id).maybeSingle(),
    supabase.from("bookmarks").select("page_number").eq("profile_id", user.id).eq("book_id", id).order("page_number"),
  ]);
  if (progress.error || bookmarks.error) throw new Error("Не удалось загрузить настройки чтения.");
  const requested = pageSchema.safeParse((await searchParams).page);
  const startPage = requested.success ? requested.data : progress.data?.page_number ?? 1;
  return <SiteShell><Link className="text-sm underline" href={`/books/${id}`}>← О материале</Link><h1 className="section-title mt-6 mb-8">{book.title}</h1><PdfReader bookId={id} initialPage={Math.min(startPage, book.page_count ?? 100000)} initialBookmarks={bookmarks.data.map(b => b.page_number)} /></SiteShell>;
}
