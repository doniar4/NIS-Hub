import {scheduleDiff,type LessonSnapshot} from "@/lib/schedule-diff";
import {subjectMap,normalizeRoom} from "@/lib/catalog";
import {subjectName,type Locale} from "@/lib/i18n";
import {v05Copy} from "@/lib/v05-copy";
import type {ClassRow,SubjectRow} from "@/lib/database.types";
import {lessonRange} from "@/lib/weekly-schedule";
import {phase4Copy} from "@/lib/phase4-copy";
export function ScheduleDiff({before,after,subjects,classes,locale}:{before:LessonSnapshot[];after:LessonSnapshot[];subjects:SubjectRow[];classes:ClassRow[];locale:Locale}){
 const diff=scheduleDiff(before,after),t=v05Copy(locale),map=subjectMap(subjects),classMap=new Map(classes.map(c=>[c.id,c.name]));
 const slot=(row:LessonSnapshot)=>[classMap.get(row.class_id)??row.class_id,phase4Copy(locale).shortDays[row.weekday-1],lessonRange(row),row.subgroup_label].filter(Boolean).join(" · ");
 const details=(row:LessonSnapshot)=>[slot(row),subjectName(map.get(row.subject_id),locale),row.start_time?.slice(0,5),row.end_time?.slice(0,5),normalizeRoom(row.room),row.effective_from??"…",row.effective_to??"…"].filter(Boolean).join(" · ");
 return <div className="space-y-4">
 <p>{t.added}: {diff.added.length} · {t.removed}: {diff.removed.length} · {t.changed}: {diff.changed.length}</p>
 {diff.added.length>0 && <details><summary>{t.added}</summary><ul>{diff.added.map(row=><li key={row.id}>{details(row)}</li>)}</ul></details>}
 {diff.removed.length>0 && <details><summary>{t.removed}</summary><ul>{diff.removed.map(row=><li key={row.id}>{details(row)}</li>)}</ul></details>}
 <ul className="divide-y divide-[var(--line)]">{diff.changed.map(change=><li key={change.after.id} className="py-3">
 <h3 className="font-semibold">{slot(change.after)}</h3><ul>{change.fields.map(field=><li key={field} className={field==="room"?"room-change":""}>{t[field]}: {
 field==="room"?normalizeRoom(change.before.room)+" → "+normalizeRoom(change.after.room):
 field==="subject"?subjectName(map.get(change.before.subject_id),locale)+" → "+subjectName(map.get(change.after.subject_id),locale):
 field==="time"?[change.before.start_time?.slice(0,5),change.before.end_time?.slice(0,5)].join("–")+" → "+[change.after.start_time?.slice(0,5),change.after.end_time?.slice(0,5)].join("–"):
 [lessonRange(change.before),change.before.effective_to??"…",change.before.teacher??"—"].join(" · ")+" → "+[lessonRange(change.after),change.after.effective_to??"…",change.after.teacher??"—"].join(" · ")
 }</li>)}</ul></li>)}</ul></div>;
}
