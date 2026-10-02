import Fuse, { type FuseResult, type FuseResultMatch } from "fuse.js";
import { HIDDEN_BOOK_TITLE, normalizeLibrarySecret, type LibraryBook } from "./library";

export type LibrarySearchDocument = Omit<LibraryBook, "description" | "tags" | "quarter"> & {
  description: string | null;
  tags: string[];
  quarter: number | null;
  subjectNames: string[];
  subjectLabel: string;
  gradeLabel: string;
  quarterLabels: string[];
};

export type LibrarySearchResult = {
  item: LibrarySearchDocument;
  score: number;
  titleMatches: readonly [number, number][];
  subjectMatches: readonly [number, number][];
  descriptionMatches: readonly [number, number][];
  tagMatches: ReadonlyMap<string, readonly [number, number][]>;
};

const keys = [
  { name: "title", weight: 0.56 },
  { name: "tags", weight: 0.17 },
  { name: "subjectNames", weight: 0.15 },
  { name: "description", weight: 0.08 },
  { name: "gradeLabel", weight: 0.02 },
  { name: "quarterLabels", weight: 0.02 },
] as const;

const keyboardRu = "йцукенгшщзхъфывапролджэячсмитьбю";
const keyboardEn = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";

function swapKeyboard(value: string, from: string, to: string) {
  return [...value].map(char => {
    const index = from.indexOf(char.toLocaleLowerCase());
    return index < 0 ? char : to[index];
  }).join("");
}

export function libraryQueryVariants(query: string): string[] {
  const clean = query.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!clean) return [];
  return [...new Set([
    clean,
    clean.replace(/h/g, "һ").replace(/H/g, "Һ"),
    clean.replace(/һ/g, "h").replace(/Һ/g, "H"),
    swapKeyboard(clean, keyboardRu, keyboardEn),
    swapKeyboard(clean, keyboardEn, keyboardRu),
  ])];
}

export function createLibrarySearchIndex(documents: LibrarySearchDocument[]) {
  const visible = documents.filter(item => normalizeLibrarySecret(item.title) !== normalizeLibrarySecret(HIDDEN_BOOK_TITLE));
  const options = { keys: [...keys], includeMatches: true, includeScore: true, ignoreLocation: true, threshold: 0.4, minMatchCharLength: 2 };
  return {
    documents,
    search: new Fuse<LibrarySearchDocument>(visible, options),
    suggestions: new Fuse<LibrarySearchDocument>(visible, { ...options, keys: [{ name: "title", weight: 0.75 }, { name: "tags", weight: 0.1 }, { name: "subjectNames", weight: 0.15 }], threshold: 0.62 }),
  };
}

function indices(match: FuseResultMatch | undefined): readonly [number, number][] {
  return match?.indices ?? [];
}

function priority(item: LibrarySearchDocument, query: string, matches: readonly FuseResultMatch[]) {
  if (normalizeLibrarySecret(item.title) === normalizeLibrarySecret(query)) return 0;
  if (matches.some(match => match.key === "title")) return 1;
  if (matches.some(match => match.key === "tags" || match.key === "subjectNames")) return 2;
  if (matches.some(match => match.key === "description")) return 3;
  return 4;
}

export function searchLibrary(index: ReturnType<typeof createLibrarySearchIndex>, query: string, filters: { grade: string; subject: string }, locale: string): { results: LibrarySearchResult[]; suggestions: string[] } {
  const secret = normalizeLibrarySecret(query) === "ниш хабчик";
  const filtered = (item: LibrarySearchDocument) => (!filters.grade || String(item.grade) === filters.grade) && (!filters.subject || item.subject_id === filters.subject);
  const plainResult = (item: LibrarySearchDocument): LibrarySearchResult => ({ item, score: 0, titleMatches: [], subjectMatches: [], descriptionMatches: [], tagMatches: new Map() });
  if (secret) {
    const item = index.documents.find(book => normalizeLibrarySecret(book.title) === normalizeLibrarySecret(HIDDEN_BOOK_TITLE));
    return { results: item && filtered(item) ? [{ item, score: 0, titleMatches: [], subjectMatches: [], descriptionMatches: [], tagMatches: new Map() }] : [], suggestions: [] };
  }
  const variants = libraryQueryVariants(query);
  if (!variants.length) {
    return { results: index.documents.filter(item => normalizeLibrarySecret(item.title) !== normalizeLibrarySecret(HIDDEN_BOOK_TITLE) && filtered(item)).map(plainResult).sort((a, b) => a.item.title.localeCompare(b.item.title, locale)), suggestions: [] };
  }
  const numeric = variants[0];
  const publicItem = (item: LibrarySearchDocument) => normalizeLibrarySecret(item.title) !== normalizeLibrarySecret(HIDDEN_BOOK_TITLE);
  if (/^(?:[7-9]|1[0-2])$/.test(numeric)) return { results: index.documents.filter(item => publicItem(item) && filtered(item) && String(item.grade) === numeric).map(plainResult).sort((a, b) => a.item.title.localeCompare(b.item.title, locale)), suggestions: [] };
  if (/^[1-4]$/.test(numeric)) return { results: index.documents.filter(item => publicItem(item) && filtered(item) && String(item.quarter) === numeric).map(plainResult).sort((a, b) => a.item.title.localeCompare(b.item.title, locale)), suggestions: [] };
  type Hit = FuseResult<LibrarySearchDocument>;
  const merged = new Map<string, { result: Hit; query: string }>();
  for (const variant of variants) for (const result of index.search.search(variant)) {
    if (!filtered(result.item)) continue;
    const previous = merged.get(result.item.id);
    if (!previous || (result.score ?? 1) < (previous.result.score ?? 1)) merged.set(result.item.id, { result, query: variant });
  }
  const results = [...merged.values()].sort((a, b) => priority(a.result.item, a.query, a.result.matches ?? []) - priority(b.result.item, b.query, b.result.matches ?? []) || (a.result.score ?? 1) - (b.result.score ?? 1) || a.result.item.title.localeCompare(b.result.item.title, locale)).map(({ result }) => {
    const matches = result.matches ?? [];
    const tags = new Map<string, readonly [number, number][]>();
    for (const match of matches) if (match.key === "tags" && match.value) tags.set(match.value, indices(match));
    const subject = matches.find(match => match.key === "subjectNames" && match.value === result.item.subjectLabel);
    return { item: result.item, score: result.score ?? 0, titleMatches: indices(matches.find(match => match.key === "title")), subjectMatches: indices(subject), descriptionMatches: indices(matches.find(match => match.key === "description")), tagMatches: tags };
  });
  if (results.length) return { results, suggestions: [] };
  const suggestions = [...new Set(variants.flatMap(variant => index.suggestions.search(variant, { limit: 6 }).filter(result => filtered(result.item)).map(result => result.item.title)))].slice(0, 3);
  return { results, suggestions };
}
