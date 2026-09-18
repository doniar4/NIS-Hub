import { parse, type DefaultTreeAdapterMap } from "parse5";
import { delimitedRows } from "./timetable-import";
import { dateSchema } from "./validation";
import type { Locale } from "./i18n";
export type Grade = {
  subject: string;
  date: string;
  score: number;
  max: number;
  type: string;
};
export const DIARY_MAX_BYTES = 1024 * 1024;
type Node = DefaultTreeAdapterMap["node"];
function children(node: Node): Node[] {
  return "childNodes" in node ? node.childNodes : [];
}
function text(node: Node): string {
  const result: string[] = [],
    stack = [node];
  while (stack.length) {
    const next = stack.pop()!;
    if (
      "tagName" in next &&
      ["script", "style", "template"].includes(next.tagName)
    )
      continue;
    if ("value" in next) result.push(next.value);
    else stack.push(...children(next).slice().reverse());
  }
  return result.join(" ").replace(/\s+/g, " ").trim();
}
function htmlTables(raw: string): string[][][] {
  const tables: Node[] = [],
    stack: Node[] = [parse(raw)];
  while (stack.length) {
    const node = stack.pop()!;
    if ("tagName" in node && node.tagName === "table") tables.push(node);
    else stack.push(...children(node).slice().reverse());
  }
  return tables.map((table) => {
    const rows: string[][] = [],
      pending = [table];
    while (pending.length) {
      const node = pending.pop()!;
      if ("tagName" in node && node.tagName === "tr") {
        const cells = children(node).filter(
          (n) => "tagName" in n && ["td", "th"].includes(n.tagName),
        );
        rows.push(cells.map(text));
      } else pending.push(...children(node).slice().reverse());
    }
    return rows;
  });
}
const headers: Record<string, string> = {
  subject: "subject",
  предмет: "subject",
  пән: "subject",
  date: "date",
  дата: "date",
  күні: "date",
  score: "score",
  балл: "score",
  баллы: "score",
  оценка: "score",
  баға: "score",
  max: "max",
  maximum: "max",
  максимум: "max",
  "макс. балл": "max",
  "ең жоғары балл": "max",
  type: "type",
  assessment: "type",
  "вид работы": "type",
  "жұмыс түрі": "type",
};
function parseTable(rows: string[][]): Grade[] | null {
  const headerIndex = rows.findIndex((row) => {
    const keys = row.map((v) => headers[v.toLocaleLowerCase().trim()]);
    return ["subject", "date", "score"].every((key) => keys.includes(key));
  });
  if (headerIndex < 0) return null;
  const columns = rows[headerIndex].map(
    (v) => headers[v.toLocaleLowerCase().trim()],
  );
  if (
    ["subject", "date", "score", "max", "type"].some(
      (key) => columns.filter((k) => k === key).length > 1,
    )
  )
    throw new Error("duplicate_header");
  const entries = rows.slice(headerIndex + 1).filter((r) => r.some(Boolean));
  if (!entries.length || entries.length > 1000) throw new Error("row_limit");
  return entries.map((row) => {
    if (row.length !== columns.length) throw new Error("column_count");
    const at = (key: string) => row[columns.indexOf(key)]?.trim() ?? "";
    const subject = at("subject"),
      kind = at("type");
    let date = at("date");
    const local = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date);
    if (local) date = `${local[3]}-${local[2]}-${local[1]}`;
    const fraction = at("score").split("/");
    if (fraction.length > 2) throw new Error("score_format");
    const rawScore = fraction[0].trim(),
      rawMax = (at("max") || fraction[1] || "").trim();
    if (
      !/^\d+(?:[.,]\d+)?$/.test(rawScore) ||
      !/^\d+(?:[.,]\d+)?$/.test(rawMax)
    )
      throw new Error("score_format");
    const score = Number(rawScore.replace(",", ".")),
      max = Number(rawMax.replace(",", "."));
    if (
      !subject ||
      subject.length > 120 ||
      kind.length > 60 ||
      !dateSchema.safeParse(date).success ||
      max <= 0 ||
      max > 1000 ||
      score < 0 ||
      score > max
    )
      throw new Error("values");
    return { subject, date, score, max, type: kind };
  });
}
export function parseDiary(raw: string): Grade[] {
  if (new TextEncoder().encode(raw).length > DIARY_MAX_BYTES)
    throw new Error("file_limit");
  const tables = /<table\b/i.test(raw) ? htmlTables(raw) : [delimitedRows(raw)];
  for (const table of tables) {
    const result = parseTable(table);
    if (result) return result;
  }
  throw new Error("unsupported_table");
}
export function demoGrades(locale: Locale): Grade[] {
  const subjects = {
    ru: ["Алгебра", "Физика", "Основы права", "Искусство"],
    kk: ["Алгебра", "Физика", "Құқық негіздері", "Өнер"],
    en: ["Algebra", "Physics", "Fundamentals of Law", "Art"],
  }[locale];
  return [
    { subject: subjects[0], date: "2026-09-07", score: 8, max: 10, type: "ФО" },
    {
      subject: subjects[0],
      date: "2026-09-14",
      score: 17,
      max: 20,
      type: "СОР",
    },
    { subject: subjects[1], date: "2026-09-08", score: 7, max: 10, type: "ФО" },
    {
      subject: subjects[1],
      date: "2026-09-15",
      score: 13,
      max: 16,
      type: "СОР",
    },
    { subject: subjects[2], date: "2026-09-10", score: 9, max: 10, type: "ФО" },
    {
      subject: subjects[3],
      date: "2026-09-11",
      score: 14,
      max: 16,
      type: "СОР",
    },
  ].map((g) => ({
    ...g,
    type:
      locale === "kk"
        ? g.type === "ФО"
          ? "ҚБ"
          : "БЖБ"
        : locale === "en"
          ? g.type === "ФО"
            ? "Formative"
            : "Unit assessment"
          : g.type,
  }));
}
export function averagePercent(rows: Grade[]): number | null {
  return rows.length
    ? rows.reduce((sum, row) => sum + (row.score / row.max) * 100, 0) /
        rows.length
    : null;
}
