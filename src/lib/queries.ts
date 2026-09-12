import { loadLibraryCatalog } from "@/lib/library";
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { uuid } from "@/lib/validation";

export async function database() {
  const client = await createClient();
  if (!client) throw new Error("База данных пока не подключена.");
  return client;
}
export const getCatalogOptions = cache(async () => {
  await requireViewer("/library");
  const supabase = await database();
  const [classes, subjects] = await Promise.all([supabase.from("classes").select("*").order("name"), supabase.from("subjects").select("*").order("name")]);
  if (classes.error || subjects.error) throw new Error("Не удалось загрузить классы и предметы.");
  return { classes: classes.data, subjects: subjects.data };
});

export async function getLibraryBooks() {
  await requireViewer("/library");
  const supabase = await database();
  return loadLibraryCatalog(async (after, size) => {
    let query = supabase.from("books").select("id,title,class_id,subject_id,language")
      .eq("publication_status", "published").eq("license_status", "approved").order("id").limit(size);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error("Could not load library catalog");
    return data;
  });
}

export async function getBook(id: string) {
  await requireViewer("/library");
  if (!uuid.safeParse(id).success) return null;
  const supabase = await database();
  const { data, error } = await supabase.from("books").select("*").eq("id", id).eq("publication_status", "published").eq("license_status", "approved").maybeSingle();
  if (error) throw new Error("Не удалось загрузить материал.");
  return data;
}

export async function getReading() {
  const { user } = await requireViewer("/profile");
  const supabase = await database();
  const [bookmarks, progress] = await Promise.all([
    supabase.from("bookmarks").select("*").eq("profile_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("reading_progress").select("*").eq("profile_id", user.id).order("updated_at", { ascending: false }).limit(20),
  ]);
  if (bookmarks.error || progress.error) throw new Error("Не удалось загрузить закладки и историю чтения.");
  const ids = [...new Set([...bookmarks.data, ...progress.data].map(item => item.book_id))];
  const books = ids.length ? await supabase.from("books").select("id,title").in("id", ids).eq("publication_status","published").eq("license_status","approved") : { data: [], error: null };
  if (books.error) throw new Error("Не удалось загрузить названия материалов.");
  return { bookmarks: bookmarks.data, progress: progress.data, books: books.data ?? [] };
}
