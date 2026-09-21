import type { ClassRow, SubjectRow } from "../database.types";
import type { WeeklyInput } from "../timetable-import";
import type { EduPageSnapshot, SourceReference } from "./types";
import { audiencesOverlap } from "./groups";
import { EduPageError } from "./errors";
export type EduPageAliases = { classes: Record<string,string>; subjects: Record<string,string> };
export type MappingIssue = { code: "class"|"subject"|"conflict"|"duplicate"|"values"; label: string };
export const normalizeAlias = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();
export const normalizeClass = (value: string) => normalizeAlias(value).replace(/\s/g,"");
export function validateAliases(value: unknown): EduPageAliases {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new EduPageError("mapping");
  const result: EduPageAliases = { classes:{}, subjects:{} };
  for (const kind of ["classes","subjects"] as const) {
    const entries = (value as Record<string,unknown>)[kind];
    if (!entries || typeof entries !== "object" || Array.isArray(entries) || Object.keys(entries).length > 1000) throw new EduPageError("mapping");
    for (const [key,id] of Object.entries(entries)) {
      if (!key || key.length > 200 || normalizeAlias(key) !== key || typeof id !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
          ["__proto__","constructor","prototype"].includes(key)) throw new EduPageError("mapping");
      result[kind][key] = id;
    }
  }
  return result;
}
export function resolveReference(source: SourceReference, catalog: {id:string;names:(string|null|undefined)[]}[],
  aliases: Record<string,string>, className=false) {
  const explicit = aliases[normalizeAlias(source.name)];
  if (explicit) return catalog.some(row=>row.id===explicit) ? explicit : null;
  const normalize = className ? normalizeClass : normalizeAlias;
  const names = new Set([normalize(source.name),normalize(source.short)]);
  const matches = catalog.filter(row=>row.names.some(n=>n && names.has(normalize(n))));
  return matches.length===1 ? matches[0].id : null;
}
export function mapEduPage(snapshot: EduPageSnapshot, classes: ClassRow[], subjects: SubjectRow[],
  aliases: EduPageAliases, selected: string[] = []) {
  const issues: MappingIssue[] = [], rows: WeeklyInput[] = [];
  const classCatalog = classes.map(c=>({id:c.id,names:[c.name]}));
  const subjectCatalog = subjects.map(s=>({id:s.id,names:[s.name,s.name_ru,s.name_kz,s.name_en,s.short_name]}));
  const sourceClasses = snapshot.classes.filter(c=>!selected.length || selected.includes(c.id));
  if (selected.some(id=>!snapshot.classes.some(c=>c.id===id)) || !sourceClasses.length) throw new EduPageError("mapping");
  const classMap = new Map(sourceClasses.map(c=>[c.id,resolveReference(c,classCatalog,aliases.classes,true)]));
  const targetClasses = [...classMap.values()].filter((id):id is string=>!!id);
  for(const c of sourceClasses) if(!classMap.get(c.id)) issues.push({code:"class",label:c.name});
  if(new Set(targetClasses).size!==targetClasses.length) issues.push({code:"class",label:sourceClasses.map(c=>c.name).join(", ")});
  const sourceLessons = snapshot.lessons.filter(row=>classMap.has(row.sourceClass));
  const used = new Set(sourceLessons.map(l=>l.sourceSubject));
  const sourceSubjects = snapshot.subjects.filter(s=>used.has(s.id));
  const subjectMap = new Map(sourceSubjects.map(s=>[s.id,resolveReference(s,subjectCatalog,aliases.subjects)]));
  for(const s of sourceSubjects) if(!subjectMap.get(s.id)) issues.push({code:"subject",label:s.name});
  for(const c of sourceClasses) if(!sourceLessons.some(l=>l.sourceClass===c.id)) issues.push({code:"values",label:c.name});
  for(const lesson of sourceLessons) {
    const class_id=classMap.get(lesson.sourceClass),subject_id=subjectMap.get(lesson.sourceSubject);
    if(!class_id || !subject_id) continue;
    const room=lesson.rooms.join(" / ") || null, teacher=lesson.teachers.join(" / ") || null;
    if((room?.length??0)>40 || (teacher?.length??0)>100) {issues.push({code:"values",label:sourceClasses.find(c=>c.id===lesson.sourceClass)!.name});continue;}
    rows.push({class_id,subject_id,weekday:lesson.weekday,lesson_start:lesson.lesson_start,lesson_end:lesson.lesson_end,
      start_time:lesson.start_time,end_time:lesson.end_time,room,teacher,effective_from:snapshot.publication.effectiveFrom,
      effective_to:snapshot.publication.effectiveTo,subgroup_key:lesson.subgroup_key,subgroup_label:lesson.subgroup_label,audience:lesson.audience});
  }
  const keys = new Set<string>();
  for (let i=0;i<rows.length;i++) {
    const a=rows[i], key=lessonIdentity(a), label=classes.find(c=>c.id===a.class_id)!.name+" · "+a.weekday+" · "+a.lesson_start+"–"+a.lesson_end;
    if(keys.has(key)) issues.push({code:"duplicate",label}); keys.add(key);
    for(let j=0;j<i;j++){
      const b=rows[j];
      if(a.class_id!==b.class_id || a.weekday!==b.weekday || !audiencesOverlap(a.audience,b.audience))continue;
      if((a.lesson_start<=b.lesson_end && b.lesson_start<=a.lesson_end) ||
        (a.start_time && a.end_time && b.start_time && b.end_time && a.start_time<b.end_time && b.start_time<a.end_time))
        issues.push({code:"conflict",label});
    }
  }
  return {rows,issues,scope:[...new Set(targetClasses)].sort(),sourceClasses,sourceSubjects};
}
export const lessonIdentity=(row:WeeklyInput)=>[row.class_id,row.weekday,row.lesson_start,row.lesson_end,row.subgroup_key??""].join("/");
