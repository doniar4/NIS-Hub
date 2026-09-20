import { attr, document, nodes, nodeText } from "./html";
import { SmsError } from "./errors";
import type { SmsAssessment, SmsDiarySnapshot, SmsSubjectSummary } from "./types";
const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase("ru").replace(/\s+/g," ").trim();
const labels: Record<string,string> = {
  "предмет":"subject","пән":"subject","subject":"subject",
  "балл":"score","баллы":"score","score":"score","ұпай":"score",
  "максимум":"max","макс. балл":"max","maximum":"max","max":"max",
  "дата":"date","күні":"date","date":"date",
  "вид работы":"type","assessment":"type","жұмыс түрі":"type",
  "процент":"percent","пайыз":"percent","percent":"percent","%":"percent",
  "тема":"title","тақырып":"title","title":"title",
};
function decimal(raw: string, maximum = 10000): number | undefined {
  if (!raw || raw === "—" || raw === "-") return undefined;
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) throw new SmsError("parse_failed");
  const number = Number(raw.replace(",","."));
  if (!Number.isFinite(number) || number > maximum) throw new SmsError("parse_failed");
  return number;
}
function date(raw: string): string | undefined {
  if (!raw || raw === "—") return undefined;
  const local = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  const result = local ? `${local[3]}-${local[2]}-${local[1]}` : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0,10) !== result) throw new SmsError("parse_failed");
  return result;
}
// Semantic table adapter. Synthetic fixtures exercise this boundary; a live,
// authenticated SMS fixture is still required before claiming portal coverage.
export function parseGrades(html: string, now = new Date()): SmsDiarySnapshot {
  const root = document(html), subjects = new Map<string,SmsSubjectSummary>();
  let recognized = false, count = 0;
  for (const table of nodes(root,"table")) {
    const rows = nodes(table,"tr").map(row => row.childNodes.filter(n => "tagName" in n && ["td","th"].includes(n.tagName)).map(nodeText));
    const headerIndex = rows.findIndex(row => row.some(c => labels[normalize(c)] === "subject") && row.some(c => ["score","percent"].includes(labels[normalize(c)])));
    if (headerIndex < 0) continue;
    recognized = true;
    const header = rows[headerIndex].map(c => labels[normalize(c)]);
    const known = header.filter(Boolean);
    if (new Set(known).size !== known.length) throw new SmsError("sms_changed");
    for (const row of rows.slice(headerIndex+1).filter(r=>r.some(Boolean))) {
      if (++count > 2000 || row.length !== header.length) throw new SmsError("sms_changed");
      const at = (name:string) => row[header.indexOf(name)]?.trim() || "";
      const subject = at("subject");
      if (!subject || subject.length > 160 || /\d{12}/.test(subject)) throw new SmsError("parse_failed");
      const pair = at("score").split("/");
      if (pair.length > 2) throw new SmsError("parse_failed");
      const score = decimal(pair[0].trim()), max = decimal(at("max") || pair[1]?.trim() || "");
      if (pair[1] && at("max") && decimal(pair[1].trim()) !== max) throw new SmsError("parse_failed");
      if (max === 0 || (score !== undefined && max !== undefined && score > max)) throw new SmsError("parse_failed");
      const supplied = decimal(at("percent").replace(/%$/,"").trim(),100);
      const percent = supplied ?? (score !== undefined && max !== undefined ? Math.round(score/max*1000)/10 : undefined);
      const rawType = normalize(at("type"));
      const type = ["сор","бжб","sor"].includes(rawType) ? "sor" : ["соч","тжб","soch"].includes(rawType) ? "soch" : ["фо","қб","formative"].includes(rawType) ? "formative" : rawType ? "other" : undefined;
      const assessment: SmsAssessment = {subject,score,max,percent,date:date(at("date")),type,
        title:at("title").slice(0,200) || undefined,percentSource:percent===undefined?undefined:supplied===undefined?"derived":"official_display"};
      if (!subjects.has(subject)) subjects.set(subject,{subject,assessments:[]});
      const summary = subjects.get(subject)!;
      // A subject-only percentage row is official summary; work rows remain separate.
      if (supplied !== undefined && score === undefined && !at("date") && !at("type") && !at("title")) {
        if (summary.percent !== undefined) throw new SmsError("sms_changed");
        summary.percent = supplied; summary.percentSource = "official_display";
      } else summary.assessments.push(assessment);
    }
  }
  if (!recognized || subjects.size > 100) throw new SmsError("sms_changed");
  for (const subject of subjects.values()) subject.assessments.sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999"));
  return {student:{},subjects:[...subjects.values()],fetchedAt:now.toISOString()};
}
export type DiaryFilter = {name:string; label:"year"|"term"; options:{value:string;label:string}[]};
export function gradeFilters(html: string) {
  const root=document(html), selects=nodes(root,"select"), allLabels=nodes(root,"label");
  const result: DiaryFilter[]=[];
  for (const select of selects) {
    const label=normalize(attr(select,"aria-label") || allLabels.filter(l=>attr(l,"for")===attr(select,"id") && attr(select,"id")).map(nodeText).join(" "));
    const kind=["учебный год","оқу жылы","academic year"].includes(label)?"year":["четверть","тоқсан","term"].includes(label)?"term":null;
    if (!kind) continue;
    const name=attr(select,"name");
    if (!name || result.some(f=>f.label===kind)) throw new SmsError("sms_changed");
    const options=nodes(select,"option").filter(o=>attr(o,"disabled")===undefined).map(o=>({value:attr(o,"value")??nodeText(o),label:nodeText(o)}));
    if (options.length>30 || options.some(o=>o.value.length>100 || o.label.length>100)) throw new SmsError("sms_changed");
    result.push({name,label:kind,options});
  }
  return result;
}
