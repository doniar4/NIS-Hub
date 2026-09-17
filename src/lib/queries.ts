import {coverPath} from "./book-cover";
import { sortClasses } from "./catalog";
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
  return { classes: sortClasses(classes.data), subjects: subjects.data };
});

export async function getLibraryBooks() {
  await requireViewer("/library");
  const supabase = await database();
  const catalog=await loadLibraryCatalog(async (after, size) => {
    let query = supabase.from("books").select("id,title,grade,subject_id")
      .eq("publication_status", "published").order("id").limit(size);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error("Could not load library catalog");
    return data;
  });
  const readable=new Set<string>();
  for(let i=0;i<catalog.books.length;i+=200){
    const batch=catalog.books.slice(i,i+200);
    const editions=await supabase.from("book_variants").select("book_id").in("book_id",batch.map(b=>b.id)).eq("publication_status","published").limit(800);
    if(editions.error)throw new Error("Could not load published editions");
    editions.data.forEach(v=>readable.add(v.book_id));
  }
  return {...catalog,books:catalog.books.filter(b=>readable.has(b.id))};
}

export async function getBook(id: string) {
  await requireViewer("/library");
  if (!uuid.safeParse(id).success) return null;
  const supabase = await database();
  const { data, error } = await supabase.from("books").select("*").eq("id", id).eq("publication_status", "published").maybeSingle();
  if (error) throw new Error("Не удалось загрузить материал.");
  return data;
}

export async function getBookVariants(bookId:string){
 const supabase=await database();
 const {data,error}=await supabase.from("book_variants").select("*").eq("book_id",bookId).eq("publication_status","published").order("created_at").order("id");
 if(error)throw new Error("Could not load editions");
 return data;
}
export async function getReading() {
  const { user } = await requireViewer("/profile");
  const supabase = await database();
  const [bookmarks, progress] = await Promise.all([
    supabase.from("variant_bookmarks").select("*").eq("profile_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("variant_reading_progress").select("*").eq("profile_id", user.id).order("updated_at", { ascending: false }).limit(20),
  ]);
  if (bookmarks.error || progress.error) throw new Error("Не удалось загрузить закладки и историю чтения.");
  const ids = [...new Set([...bookmarks.data, ...progress.data].map(item => item.book_variant_id))];
  const variants=ids.length?await supabase.from("book_variants").select("*").in("id",ids).eq("publication_status","published"):{data:[],error:null};
  if(variants.error)throw new Error("Could not load editions");
  const bookIds=[...new Set(variants.data.map(v=>v.book_id))];
  const books = bookIds.length ? await supabase.from("books").select("id,title,cover_path").in("id", bookIds).eq("publication_status","published") : { data: [], error: null };
  if (books.error) throw new Error("Не удалось загрузить названия материалов.");
  const catalog=variants.data.flatMap(v=>{const book=books.data?.find(b=>b.id===v.book_id);return book?[{...book,id:v.id,book_id:v.book_id,cover_path:v.cover_path,language:v.language}]:[];}), paths=catalog.map(coverPath).filter((path):path is string=>!!path);
  const covers=paths.length?await supabase.storage.from("book-covers").createSignedUrls(paths,60):{data:[]};
  const urls=new Map((covers.data??[]).map(row=>[row.path,row.signedUrl]));
  return { bookmarks: bookmarks.data.map(b=>({...b,book_id:b.book_variant_id})), progress: progress.data.map(b=>({...b,book_id:b.book_variant_id})), books: catalog.map(book=>({...book,cover_url:urls.get(coverPath(book)??"")??null})) };
}
