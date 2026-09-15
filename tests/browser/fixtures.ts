import type { ClassRow, SubjectRow } from "../../src/lib/database.types";
import type { LibraryBook } from "../../src/lib/library";
export const fixtureClass = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const classes: ClassRow[] = [10, 11].map((n, i) => ({ id: fixtureClass(n), name: i ? "8B" : "7A", grade: i ? 8 : 7, section: i ? "B" : "A", created_at: "" }));
export const subjects: SubjectRow[] = [20, 21, 22, 23].map((n, i) => ({
  id: fixtureClass(n), name: ["Математика", "Физика", "Биология", "Химия"][i],
  name_kz: ["Математика", "Физика", "Биология", "Химия"][i], name_en: ["Mathematics", "Physics", "Biology", "Chemistry"][i],
  short_name: null, created_at: "",
}));
export const books: LibraryBook[] = Array.from({ length: 125 }, (_, i) => ({
  id: fixtureClass(100 + i), title: i % 2 ? "Алгебра " + i : "Physics " + i,
  grade: classes[i % 3 ? 0 : 1].grade, subject_id: subjects[i % 2 ? 0 : 1].id, language: "Original metadata",
}));
