import type { ClassRow, SubjectRow } from "../database.types";
import type { WeeklyInput } from "../timetable-import";
import type { EduPageSnapshot, SourceReference } from "./types";
import { audiencesOverlap } from "./groups";
import { EduPageError } from "./errors";
export type EduPageAliases = { classes: Record<string,string>; subjects: Record<string,string> };
export type MappingIssue = { code: "class"|"subject"|"conflict"|"duplicate"|"values"; label: string; sourceClass?: string };
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
  const issues: MappingIssue[] = [], rows: WeeklyInput[] = [], blocked = new Set<string>();
  const issueKeys = new Set<string>();
  const sourceName=(id:string)=>snapshot.classes.find(c=>c.id===id)?.name??id;
  const addIssue=(code:MappingIssue["code"],label:string,sourceClass?:string)=>{
    const issueKey=[code,label,sourceClass??""].join("\u0000");
    if(!issueKeys.has(issueKey)){
      issueKeys.add(issueKey);
      issues.push({code,label,...(sourceClass?{sourceClass}:{})});
    }
    if(sourceClass)blocked.add(sourceClass);
  };
  const classCatalog = classes.map(c=>({id:c.id,names:[c.name]}));
  const subjectCatalog = subjects.map(s=>({id:s.id,names:[s.name,s.name_ru,s.name_kz,s.name_en,s.short_name]}));
  const sourceClasses = snapshot.classes.filter(c=>!selected.length || selected.includes(c.id));
  if (selected.some(id=>!snapshot.classes.some(c=>c.id===id)) || !sourceClasses.length) throw new EduPageError("mapping");
  const classMap = new Map(sourceClasses.map(c=>[c.id,resolveReference(c,classCatalog,aliases.classes,true)]));
  const targetClasses = [...classMap.values()].filter((id):id is string=>!!id);
  for(const c of sourceClasses) if(!classMap.get(c.id)) addIssue("class",c.name,c.id);
  const byTarget = new Map<string,string[]>();
  for(const [source,target] of classMap) if(target)byTarget.set(target,[...(byTarget.get(target)??[]),source]);
  for(const sources of byTarget.values()) if(sources.length>1)
    for(const source of sources)addIssue("class",sourceName(source),source);
  const sourceLessons = snapshot.lessons.filter(row=>classMap.has(row.sourceClass));
  const used = new Set(sourceLessons.map(l=>l.sourceSubject));
  const sourceSubjects = snapshot.subjects.filter(s=>used.has(s.id));
  const subjectMap = new Map(sourceSubjects.map(s=>[s.id,resolveReference(s,subjectCatalog,aliases.subjects)]));
  for(const s of sourceSubjects) if(!subjectMap.get(s.id)){
    const affected=[...new Set(sourceLessons.filter(l=>l.sourceSubject===s.id).map(l=>l.sourceClass))];
    for(const sourceClass of affected)addIssue("subject",s.name+" · "+sourceName(sourceClass),sourceClass);
  }
  for(const c of sourceClasses) if(!sourceLessons.some(l=>l.sourceClass===c.id)) addIssue("values",c.name,c.id);
  for(const lesson of sourceLessons) {
    const class_id=classMap.get(lesson.sourceClass),subject_id=subjectMap.get(lesson.sourceSubject);
    if(!class_id || !subject_id) continue;
    const room=lesson.rooms.join(" / ") || null, teacher=lesson.teachers.join(" / ") || null;
    if((room?.length??0)>40 || (teacher?.length??0)>100) {addIssue("values",sourceName(lesson.sourceClass),lesson.sourceClass);continue;}
    rows.push({class_id,subject_id,weekday:lesson.weekday,lesson_start:lesson.lesson_start,lesson_end:lesson.lesson_end,
      start_time:lesson.start_time,end_time:lesson.end_time,room,teacher,effective_from:snapshot.publication.effectiveFrom,
      effective_to:snapshot.publication.effectiveTo,subgroup_key:lesson.subgroup_key,subgroup_label:lesson.subgroup_label,audience:lesson.audience});
  }
  // EduPage can emit the same logical lesson more than once (for example,
  // duplicated cards/resources for the same subject/subgroup/slot). Merge only
  // rows that are identical in scheduling semantics; different subjects or
  // subgroup audiences remain separate and will still be reported as conflicts.
  const merged = new Map<string, WeeklyInput>();
  const splitValues = (value: string | null | undefined) =>
    (value ?? "").split(" / ").map(part=>part.trim()).filter(Boolean);
  const mergeValues = (a: string | null | undefined, b: string | null | undefined, max: number) => {
    const value=[...new Set([...splitValues(a),...splitValues(b)])].sort().join(" / ");
    return value.length <= max ? (value || null) : undefined;
  };
  for (const row of rows) {
    const key=[
      row.class_id,row.subject_id,row.weekday,row.lesson_start,row.lesson_end,
      row.start_time??"",row.end_time??"",row.effective_from??"",row.effective_to??"",
      row.subgroup_key??"",row.audience??""
    ].join("\u0000");
    const previous=merged.get(key);
    if(!previous){ merged.set(key,row); continue; }
    const teacher=mergeValues(previous.teacher,row.teacher,100);
    const room=mergeValues(previous.room,row.room,40);
    if(teacher===undefined || room===undefined){
      const source=sourceLessons.find(l=>classMap.get(l.sourceClass)===row.class_id)?.sourceClass;
      addIssue("values",classes.find(c=>c.id===row.class_id)?.name??row.class_id,source);
      continue;
    }
    merged.set(key,{...previous,teacher,room});
  }
  rows.splice(0,rows.length,...merged.values());

  // EduPage sometimes exports upper-grade parallel subject blocks as several
  // simultaneous whole-class rows, even though they are alternatives for
  // different pupil groups. It may also include one whole-class aggregate row
  // together with explicit subgroup rows for the same subject.
  const normalizeParallelUpperGradeBlocks = () => {
    const slotKey=(row:WeeklyInput)=>[
      row.class_id,row.weekday,row.lesson_start,row.lesson_end,
      row.start_time??"",row.end_time??"",
      row.effective_from??"",row.effective_to??""
    ].join("\u0000");
    const bySlot=new Map<string,WeeklyInput[]>();
    for(const row of rows){
      const key=slotKey(row);
      bySlot.set(key,[...(bySlot.get(key)??[]),row]);
    }
    const normalized:WeeklyInput[]=[];
    for(const slotRows of bySlot.values()){
      const classRow=classes.find(c=>c.id===slotRows[0].class_id);
      const grade=classRow?.grade ?? Number(classRow?.name.trim().match(/^(\d{1,2})(?!\d)/)?.[1]);
      if(!Number.isInteger(grade) || grade<11 || grade>12 || slotRows.length<2){
        normalized.push(...slotRows);
        continue;
      }

      const subjectsWithSpecificGroups=new Set(
        slotRows.filter(row=>!!row.subgroup_key).map(row=>row.subject_id)
      );
      let current=slotRows.filter(row=>
        !(!row.subgroup_key && subjectsWithSpecificGroups.has(row.subject_id))
      );

      if(current.length<2){
        normalized.push(...current);
        continue;
      }

      const whole=current.filter(row=>!row.subgroup_key || row.audience==="{(,)}");
      if(!whole.length){
        normalized.push(...current);
        continue;
      }

      if(whole.length>48){
        normalized.push(...current);
        continue;
      }

      const wholeIndex=new Map<WeeklyInput,number>();
      whole
        .slice()
        .sort((a,b)=>
          (a.subject_id+"|"+(a.teacher??"")+"|"+(a.room??""))
          .localeCompare(b.subject_id+"|"+(b.teacher??"")+"|"+(b.room??""))
        )
        .forEach((row,index)=>wholeIndex.set(row,index));

      current=current.map(row=>{
        const index=wholeIndex.get(row);
        if(index===undefined) return row;
        const cell=208+index;
        return {
          ...row,
          subgroup_key:`parallel:${row.subject_id}:${index+1}`,
          subgroup_label:row.subgroup_label || `Параллель ${index+1}`,
          audience:`{[${cell},${cell+1})}`
        };
      });
      normalized.push(...current);
    }
    rows.splice(0,rows.length,...normalized);
  };
  normalizeParallelUpperGradeBlocks();

  // Final normalization for a small set of verified upper-grade elective
  // subjects that EduPage exports without usable subgroup identity.
  //
  // These subjects are taught in parallel blocks. EduPage may expose one or
  // more of them as whole-class rows even though pupils attend only one option.
  // Restrict this rule to grades 11–12 and to the reviewed elective subject set.
  const normalizeKnownUpperGradeElectiveOverlaps = () => {
    const normalizeSubject=(value:string|null|undefined)=>
      (value??"").normalize("NFKC").trim().replace(/\s+/g," ").toLocaleLowerCase();

    const electiveNames=new Set([
      "нанотехнология",
      "nanotechnology",
      "гип",
      "gip",
      "икт",
      "акт",
      "ict",
      "лаборант химич.анализа",
      "лаборант химического анализа",
      "chemical analysis laboratory assistant"
    ]);

    const isElective=(row:WeeklyInput)=>{
      const s=subjects.find(subject=>subject.id===row.subject_id);
      return [s?.name,s?.name_ru,s?.name_kz,s?.name_en,s?.short_name]
        .some(name=>electiveNames.has(normalizeSubject(name)));
    };

    const overlaps=(a:WeeklyInput,b:WeeklyInput)=>
      a.class_id===b.class_id &&
      a.weekday===b.weekday &&
      (
        (a.lesson_start<=b.lesson_end && b.lesson_start<=a.lesson_end) ||
        (a.start_time && a.end_time && b.start_time && b.end_time &&
          a.start_time<b.end_time && b.start_time<a.end_time)
      );

    const changed=new Set<number>();
    for(let i=0;i<rows.length;i++){
      const a=rows[i];
      const classRow=classes.find(c=>c.id===a.class_id);
      const grade=classRow?.grade ?? Number(classRow?.name.trim().match(/^(\d{1,2})(?!\d)/)?.[1]);
      if(!Number.isInteger(grade) || grade<11 || grade>12 || !isElective(a)) continue;

      const peers=rows
        .map((row,index)=>({row,index}))
        .filter(({row,index})=>index!==i && overlaps(a,row) && isElective(row));

      if(!peers.length) continue;

      // Give only unresolved whole-class rows a stable synthetic audience.
      // Existing explicit/synthetic subgroup rows remain untouched.
      const candidates=[{row:a,index:i},...peers]
        .filter(({row})=>!row.subgroup_key || row.audience==="{(,)}")
        .sort((x,y)=>{
          const ax=subjects.find(s=>s.id===x.row.subject_id);
          const ay=subjects.find(s=>s.id===y.row.subject_id);
          return normalizeSubject(ax?.name_ru??ax?.name)
            .localeCompare(normalizeSubject(ay?.name_ru??ay?.name));
        });

      candidates.forEach(({row,index},position)=>{
        if(changed.has(index)) return;
        const cell=240+position;
        if(cell>=256) return;
        rows[index]={
          ...row,
          subgroup_key:`elective:${row.subject_id}:${position+1}`,
          subgroup_label:row.subgroup_label || `Параллель ${position+1}`,
          audience:`{[${cell},${cell+1})}`
        };
        changed.add(index);
      });
    }
  };
  normalizeKnownUpperGradeElectiveOverlaps();

  const keys = new Set<string>();
  for (let i=0;i<rows.length;i++) {
    const a=rows[i], key=lessonIdentity(a);
    const subject=subjects.find(s=>s.id===a.subject_id);
    const subjectLabel=subject?.name_ru??subject?.name??a.subject_id;
    const subgroup=a.subgroup_label?` · ${a.subgroup_label}`:"";
    const label=classes.find(c=>c.id===a.class_id)!.name+" · "+a.weekday+" · "+a.lesson_start+"–"+a.lesson_end+" · "+subjectLabel+subgroup;
    if(keys.has(key)) addIssue("duplicate",label,sourceLessons.find(l=>classMap.get(l.sourceClass)===a.class_id)?.sourceClass); keys.add(key);
    for(let j=0;j<i;j++){
      const b=rows[j];
      if(a.class_id!==b.class_id || a.weekday!==b.weekday || !audiencesOverlap(a.audience,b.audience))continue;
      if((a.lesson_start<=b.lesson_end && b.lesson_start<=a.lesson_end) ||
        (a.start_time && a.end_time && b.start_time && b.end_time && a.start_time<b.end_time && b.start_time<a.end_time)) {
        const bSubject=subjects.find(s=>s.id===b.subject_id);
        const bSubjectLabel=bSubject?.name_ru??bSubject?.name??b.subject_id;
        const bSubgroup=b.subgroup_label?(" · "+b.subgroup_label):"";
        const pairLabel=
          label+
          " ↔ "+bSubjectLabel+bSubgroup+
          " ["+(a.audience??"{(,)}")+" ↔ "+(b.audience??"{(,)}")+"]";
        addIssue("conflict",pairLabel,sourceLessons.find(l=>classMap.get(l.sourceClass)===a.class_id)?.sourceClass);
      }
    }
  }
  const blockedTargets=new Set([...blocked].map(id=>classMap.get(id)).filter((id):id is string=>!!id));
  const safeRows=rows.filter(row=>!blockedTargets.has(row.class_id));
  const scope=[...new Set(targetClasses.filter(id=>!blockedTargets.has(id)))].sort();
  const blockedClasses=sourceClasses.filter(c=>blocked.has(c.id));
  return {rows:safeRows,issues,scope,sourceClasses,sourceSubjects,blockedClasses};
}
export const lessonIdentity=(row:WeeklyInput)=>[row.class_id,row.weekday,row.lesson_start,row.lesson_end,row.subgroup_key??""].join("/");
