import test from "node:test";
import assert from "node:assert/strict";
import { createLibrarySearchIndex, libraryQueryVariants, searchLibrary, type LibrarySearchDocument } from "../src/lib/library-search";

const documents: LibrarySearchDocument[] = [
  { id: "1", title: "Физика", description: "Механика және қозғалыс", tags: ["механика"], quarter: 2, grade: 9, subject_id: "physics", subjectLabel: "Физика", subjectNames: ["Физика", "Physics"], gradeLabel: "9 класс", quarterLabels: ["2", "2 четверть"] },
  { id: "2", title: "Механика есептері", description: "Физикадан жаттығулар", tags: ["physics"], quarter: 1, grade: 10, subject_id: "physics", subjectLabel: "Физика", subjectNames: ["Физика", "Physics"], gradeLabel: "10 класс", quarterLabels: ["1", "1 четверть"] },
  { id: "3", title: "Қазақстан тарихы", description: "Орта ғасырлар туралы материал", tags: ["тарих"], quarter: 3, grade: 8, subject_id: "history", subjectLabel: "Қазақстан тарихы", subjectNames: ["Қазақстан тарихы", "История Казахстана", "History of Kazakhstan"], gradeLabel: "8 класс", quarterLabels: ["3", "3 четверть"] },
  { id: "4", title: "Biology essentials", description: "Cells and organisms", tags: ["biology"], quarter: 4, grade: 7, subject_id: "biology", subjectLabel: "Biology", subjectNames: ["Биология", "Biology"], gradeLabel: "7 grade", quarterLabels: ["4", "4 quarter"] },
];

const index = createLibrarySearchIndex(documents);
const run = (query: string) => searchLibrary(index, query, { grade: "", subject: "" }, "ru");

test("fuzzy library search tolerates typos and a wrong Russian/English keyboard layout", () => {
  assert.equal(run("физка").results[0]?.item.id, "1");
  assert.equal(run("Қазақсан").results[0]?.item.id, "3");
  assert.equal(run("Biolgy").results[0]?.item.id, "4");
  assert.equal(run("abpbrf").results[0]?.item.id, "1");
  assert.ok(libraryQueryVariants("abpbrf").includes("физика"));
});

test("ranking keeps exact title before fuzzy title, tags or descriptions", () => {
  const results = run("Физика").results;
  assert.equal(results[0]?.item.id, "1");
  assert.equal(results[1]?.item.id, "2");
  assert.ok(results[0].titleMatches.length > 0);
});

test("grade and subject filters apply after fuzzy matching and empty results offer suggestions", () => {
  assert.deepEqual(searchLibrary(index, "физка", { grade: "7", subject: "" }, "ru").results, []);
  assert.equal(searchLibrary(index, "physics", { grade: "10", subject: "physics" }, "en").results[0]?.item.id, "2");
  assert.ok(run("Физззз").suggestions.includes("Физика"));
  assert.equal(run("7").results[0]?.item.id, "4");
  assert.equal(run("3").results[0]?.item.id, "3");
});
