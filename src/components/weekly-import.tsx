"use client";
import { subjectMap, normalizeRoom } from "@/lib/catalog";
import { useMemo, useRef, useState, useTransition } from "react";
import { useI18n } from "./locale-provider";
import { phase4Copy } from "@/lib/phase4-copy";
import { parseTimetable, TIMETABLE_BYTES, type ImportPreview } from "@/lib/timetable-import";
import { lessonRange } from "@/lib/weekly-schedule";
import { subjectName } from "@/lib/i18n";
import type { ClassRow, SubjectRow, WeeklyLesson } from "@/lib/database.types";
import type { ActionState, FormAction } from "@/lib/action-state";
export function WeeklyImport({ classes, subjects, lessons = [], action }: { classes: ClassRow[]; subjects: SubjectRow[]; lessons?: WeeklyLesson[]; action: FormAction }) {
  const subjectsById=useMemo(()=>subjectMap(subjects),[subjects]);
  const { locale, t } = useI18n(); const p = phase4Copy(locale);
  const [raw,setRaw] = useState(""), [preview,setPreview] = useState<ImportPreview | null>(null);
  const [state,setState] = useState<ActionState>({}), [confirmed,setConfirmed] = useState(false);
  const [pending,startTransition] = useTransition(); const revision = useRef(0);
  function clear() { revision.current++; setPreview(null); setState({}); setConfirmed(false); }
  return <section className="mt-10 space-y-5">
    <h2 className="section-title">{p.csvTitle}</h2><p className="text-sm text-[var(--muted)]">{p.csvHint}</p>
    <a className="underline" href="/templates/weekly-schedule.csv" download>{p.template}</a>
    <fieldset disabled={pending} className="space-y-5">
      <label className="block"><span className="field-label">{p.csvFile}</span><input className="field" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={async event => {
        const file = event.target.files?.[0]; clear(); setRaw(""); const version = revision.current;
        if (!file) return;
        if (file.size > TIMETABLE_BYTES) { setState({ error: p.limit }); return; }
        try { const value = await file.text(); if (version === revision.current) setRaw(value); }
        catch { if (version === revision.current) setState({ error: p.format }); }
      }}/></label>
      <label className="block"><span className="field-label">{p.paste}</span><textarea className="field font-mono text-sm" rows={9} value={raw} maxLength={TIMETABLE_BYTES}
        onChange={event => { clear(); setRaw(event.target.value); }}/></label>
      <button type="button" className="button button-secondary" onClick={() => { setPreview(parseTimetable(raw,classes,subjects,lessons)); setConfirmed(false); setState({}); }}>{p.preview}</button>
      {preview && <div>
        {preview.issues.length > 0 && <ul role="alert" className="my-4 max-h-64 overflow-auto">{preview.issues.map((issue,index) => <li key={index}>{p.row} {issue.row}: {p[issue.code]}</li>)}</ul>}
        <p role="status">{p.preview}: {preview.lessons.length}</p>
        <div className="mt-4 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label={p.preview}>
          <table className="w-full text-left text-sm"><caption className="sr-only">{p.preview}</caption>
            <thead><tr>{[t.class,p.weeklyTitle,t.lesson,t.subject,t.teacher,t.room].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
            <tbody>{preview.lessons.map((row,index) => <tr key={index} className="border-t border-[var(--line)]">
              <td className="p-2">{classes.find(c=>c.id===row.class_id)?.name}</td><td className="p-2">{p.shortDays[row.weekday-1]}</td>
              <td className="p-2">{lessonRange(row)}<br/>{row.start_time}–{row.end_time}{(row.effective_from || row.effective_to) && <p>{row.effective_from || "…"} — {row.effective_to || "…"}</p>}</td>
              <td className="p-2">{subjectName(subjectsById.get(row.subject_id),locale)}</td><td className="p-2">{row.teacher}</td><td className="p-2">{normalizeRoom(row.room)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {!preview.issues.length && <div className="mt-5 space-y-5">
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1"/>{p.confirm}</label>
          <button type="button" className="button" disabled={!confirmed || pending} onClick={()=>startTransition(async ()=>{
            const form=new FormData(); form.set("timetable",raw); form.set("confirm","on");
            try { setState(await action({},form)); } catch { setState({ error: p.importError }); }
            setConfirmed(false);
          })}>{pending ? t.saving : p.import}</button>
        </div>}
      </div>}
    </fieldset>
    {state.error && <p role="alert" className="whitespace-pre-line">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
    <details><summary>{p.catalogNames}</summary><p className="my-3">{classes.map(c=>c.name).join(", ")}</p><ul>{subjects.map(s=><li key={s.id}>{[s.name,s.name_kz,s.name_en,s.short_name].filter(Boolean).join(" / ")}</li>)}</ul></details>
  </section>;
}
