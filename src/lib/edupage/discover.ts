import { parse, type DefaultTreeAdapterMap } from "parse5";
import { EduPageError } from "./errors";
import type { EduPageDiscovery, EduPagePublication } from "./types";
import { dateSchema } from "../validation";
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new EduPageError("source_changed");
  return value as Record<string, unknown>;
}
export function jsonResult(raw: string) {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new EduPageError("source_changed"); }
  const root = object(value);
  if (root.error || root.e || !("r" in root)) throw new EduPageError("source_changed");
  return object(root.r);
}
export function discoverEduPage(html: string): EduPageDiscovery {
  const scripts: string[] = [];
  function visit(node: DefaultTreeAdapterMap["node"]) {
    if ("tagName" in node && node.tagName === "script" && !node.attrs.some(a => a.name === "src"))
      scripts.push(node.childNodes.filter(n => n.nodeName === "#text").map(n => (n as DefaultTreeAdapterMap["textNode"]).value).join(""));
    if ("childNodes" in node) node.childNodes.forEach(visit);
  }
  visit(parse(html));
  const source = scripts.join("\n");
  if (!source.includes('/timetable/ttviewer.js#TTViewer')) throw new EduPageError("source_changed");
  const yearMatches = [...source.matchAll(/"year_auto"\s*:\s*(\d{4})/g)];
  const signatures = [...source.matchAll(/ASC\.gsechash\s*=\s*"([a-zA-Z0-9]{8,64})"/g)];
  const users = [...source.matchAll(/"loggedUser"\s*:\s*"([^"]*)"/g)];
  if (users.length !== 1 || users[0][1]) throw new EduPageError("login_required");
  const year = Number(yearMatches[0]?.[1]);
  if (yearMatches.length !== 1 || signatures.length !== 1 || year < 2000 || year > 2100) throw new EduPageError("source_changed");
  return { year, signature: signatures[0][1] };
}
export function discoverPublication(raw: string): EduPagePublication {
  const regular = object(jsonResult(raw).regular), list = regular.timetables;
  if (!Array.isArray(list) || list.length > 100 || typeof regular.default_num !== "string") throw new EduPageError("source_changed");
  const matches = list.map(object).filter(row => row.tt_num === regular.default_num && row.hidden === false);
  if (matches.length !== 1) throw new EduPageError("source_changed");
  const row = matches[0];
  if (!/^\d{1,10}$/.test(String(row.tt_num)) || typeof row.year !== "number" || !Number.isInteger(row.year) ||
      row.year < 2000 || row.year > 2100 || typeof row.text !== "string" || row.text.length > 200 ||
      !dateSchema.safeParse(row.datefrom).success) throw new EduPageError("source_changed");
  const effectiveTo = row.dateto == null || row.dateto === "" ? null : row.dateto;
  if (effectiveTo !== null && (!dateSchema.safeParse(effectiveTo).success || String(effectiveTo) < String(row.datefrom))) throw new EduPageError("source_changed");
  return { number: String(row.tt_num), year: row.year, label: row.text,
    effectiveFrom: row.datefrom as string, effectiveTo: effectiveTo as string | null };
}
