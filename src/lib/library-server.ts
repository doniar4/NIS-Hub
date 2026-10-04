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
): Promise<LibraryPage> {
  if (!(await getViewer()).user) throw new Error("Authentication required");
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 100000 ||
    (filters.grade && !/^(7|8|9|10|11|12)$/.test(filters.grade)) ||
    (filters.subject && !uuid.safeParse(filters.subject).success)
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
    p_secret: normalizeLibrarySecret(filters.q) === "ниш хабчик",
  });
  if (!error && data) {
    return data as unknown as LibraryPage;
  }

  console.warn(
    `[library_page RPC fallback] code=${error?.code} message=${error?.message} details=${error?.details}`,
  );

  // Fallback to direct books table query if the custom RPC is unavailable or misconfigured
  let bookQuery = db
    .from("books")
    .select("id,title,description,tags,quarter,grade,subject_id,author,publisher", { count: "exact" })
    .eq("publication_status", "published");

  if (filters.grade) {
    bookQuery = bookQuery.eq("grade", Number(filters.grade));
  }
  if (filters.subject) {
    bookQuery = bookQuery.eq("subject_id", filters.subject);
  }
  if (filters.q.trim()) {
    bookQuery = bookQuery.ilike("title", `%${filters.q.trim()}%`);
  }
  bookQuery = bookQuery.order("title").range(offset, offset + 23);

  const { data: books, count, error: booksError } = await bookQuery;
  if (booksError) {
    console.error("Direct library query error:", booksError);
    throw new Error(`Не удалось загрузить библиотеку: ${booksError.message}`);
  }

  const bookIds = (books ?? []).map((b) => b.id);
  const variants = bookIds.length
    ? await db
        .from("book_variants")
        .select("book_id,language")
        .in("book_id", bookIds)
        .eq("publication_status", "published")
    : { data: [] };

  const langMap = new Map<string, string[]>();
  for (const v of variants.data ?? []) {
    const list = langMap.get(v.book_id) ?? [];
    if (!list.includes(v.language)) list.push(v.language);
    langMap.set(v.book_id, list);
  }

  const total = count ?? books?.length ?? 0;
  return {
    books: (books ?? []).map((b) => ({
      ...b,
      languages: langMap.get(b.id) ?? [],
    })),
    total,
    nextOffset: total > offset + 24 ? offset + 24 : null,
    suggestions: [],
  };
}

export async function getLibraryPersonal() {
  const { user } = await getViewer();
  if (!user) return { history: [], recent: [] };
  const db = await database();
  try {
    const [history, recent] = await Promise.all([
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
    if (history.error || recent.error) {
      return { history: [], recent: [] };
    }
    const ids = (recent.data ?? []).map((r) => r.book_id);
    const books = ids.length
      ? await db
          .from("books")
          .select("id,title")
          .in("id", ids)
          .eq("publication_status", "published")
      : { data: [], error: null };
    return {
      history: history.data ?? [],
      recent: (recent.data ?? []).flatMap((r) => {
        const b = books.data?.find((b) => b.id === r.book_id);
        return b ? [{ ...b, opened_at: r.opened_at }] : [];
      }),
    };
  } catch {
    return { history: [], recent: [] };
  }
}
