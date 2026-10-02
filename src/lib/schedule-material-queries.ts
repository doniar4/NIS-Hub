import "server-only";
import { database } from "./queries";
import { requireViewer } from "./auth";
import { materialDestinations, type MaterialEdition } from "./schedule-materials";
import type { LibraryBook } from "./library";

const MATERIAL_BOOK_LIMIT = 1000;

export async function getTimetableMaterials(subjects: string[], grades: (number | null)[]) {
  if (!subjects.length || !grades.length) return {};
  const { user } = await requireViewer("/schedule");
  const db = await database();
  const progressPromise = db.from("variant_reading_progress").select("book_variant_id")
    .eq("profile_id", user.id).order("updated_at", { ascending: false }).limit(100);

  // Timetable links need only these subjects and grades, not the full Library catalog.
  // books_grade_subject_idx supports the published-book grade/subject filter.
  let query = db.from("books").select("id,title,subject_id,grade")
    .eq("publication_status", "published")
    .in("subject_id", [...new Set(subjects)]).order("id").limit(MATERIAL_BOOK_LIMIT);
  const numericGrades = [...new Set(grades.filter((grade): grade is number => grade !== null))];
  if (!grades.includes(null) && numericGrades.length) query = query.in("grade", numericGrades);
  const catalog = await query;
  if (catalog.error) throw new Error("Could not resolve schedule materials");

  // A capped response must never be mistaken for one uniquely matching book.
  const truncated = catalog.data.length === MATERIAL_BOOK_LIMIT;
  const books = catalog.data as LibraryBook[];
  const batches = [];
  for (let i = 0; i < books.length; i += 200) {
    batches.push(db.from("book_variants").select("id,book_id")
      .eq("publication_status", "published")
      .in("book_id", books.slice(i, i + 200).map(book => book.id)).limit(800));
  }
  const [progress, ...variantResults] = await Promise.all([progressPromise, ...batches]);
  if (progress.error) throw new Error("Could not resolve reading preferences");
  if (variantResults.some(result => result.error)) throw new Error("Could not resolve schedule materials");
  const editions: MaterialEdition[] = variantResults.flatMap(result => result.data ?? []);
  const readable = new Set(editions.map(edition => edition.book_id));
  return materialDestinations(books.filter(book => readable.has(book.id)), editions,
    progress.data.map(row => row.book_variant_id), subjects, grades, truncated);
}
