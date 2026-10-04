import "server-only";
import { database } from "./queries";
import { getViewer } from "./auth";
import { uuid } from "./validation";
import { libraryQueryVariants } from "./library-normalize";
import {
  normalizeLibrarySecret,
  type LibraryFilters,
  type LibraryPage,
} from "./library";

export async function getLibraryPage(
  filters: LibraryFilters,
  offset = 0,
  favorites = false,
  collection = "",
): Promise<LibraryPage> {
  if (!(await getViewer()).user) throw new Error("Authentication required");
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 100000 ||
    (filters.grade && !/^(7|8|9|10|11|12)$/.test(filters.grade)) ||
    (filters.subject && !uuid.safeParse(filters.subject).success) ||
    (collection && !uuid.safeParse(collection).success)
  )
    throw new Error("Invalid filters");
  const queries = libraryQueryVariants(filters.q.slice(0, 100));
  if (filters.q.trim() && !queries.length)
    return { books: [], total: 0, nextOffset: null, suggestions: [] };
  const db = await database();
  const { data, error } = await db.rpc("library_page", {
    p_queries: queries,
    p_grade: filters.grade ? Number(filters.grade) : null,
    p_subject: filters.subject || null,
    p_offset: offset,
    p_favorites: favorites,
    p_collection: collection || null,
    p_secret: normalizeLibrarySecret(filters.q) === "ниш хабчик",
  });
  if (error)
    throw new Error(
      "Не удалось загрузить библиотеку. Проверьте миграцию Library.",
    );
  return data as unknown as LibraryPage;
}

export async function getLibraryPersonal() {
  const { user } = await getViewer();
  if (!user) throw new Error("Authentication required");
  const db = await database();
  const [collections, history, recent] = await Promise.all([
    db
      .from("library_collections")
      .select("id,name")
      .eq("user_id", user.id)
      .order("name")
      .limit(100),
    db
      .from("library_search_history")
      .select("query,searched_at")
      .eq("user_id", user.id)
      .order("searched_at", { ascending: false })
      .limit(20),
    db
      .from("library_recent_books")
      .select("book_id,opened_at")
      .eq("user_id", user.id)
      .order("opened_at", { ascending: false })
      .limit(20),
  ]);
  if (collections.error || history.error || recent.error)
    throw new Error("Не удалось загрузить личную библиотеку.");
  const ids = recent.data.map((r) => r.book_id);
  const books = ids.length
    ? await db
        .from("books")
        .select("id,title")
        .in("id", ids)
        .eq("publication_status", "published")
    : { data: [], error: null };
  if (books.error) throw new Error("Не удалось загрузить недавние материалы.");
  return {
    collections: collections.data,
    history: history.data,
    recent: recent.data.flatMap((r) => {
      const b = books.data?.find((b) => b.id === r.book_id);
      return b ? [{ ...b, opened_at: r.opened_at }] : [];
    }),
  };
}
