"use client";
import {subjectMap,normalizeRoom} from "@/lib/catalog";
import { useMemo, useRef, useState } from "react";
import { useI18n } from "./locale-provider";
import { ActionForm } from "./action-form";
import { parseScheduleImport, SCHEDULE_IMPORT_BYTES, type ScheduleEntry } from "@/lib/schedule-source";
import { subjectName } from "@/lib/i18n";
import type { ClassRow, SubjectRow } from "@/lib/database.types";
import type { FormAction } from "@/lib/action-state";

export function ScheduleImport({ action, classes, subjects }: { action: FormAction; classes: ClassRow[]; subjects: SubjectRow[] }) {
  const { t, locale } = useI18n();
  const subjectsById=useMemo(()=>subjectMap(subjects),[subjects]);
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<ScheduleEntry[]>([]);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  async function choose(file: File | undefined) {
    const current = ++generation.current;
    setRaw(""); setRows([]); setFailed(false);
    if (!file) return;
    try {
      if (file.size > SCHEDULE_IMPORT_BYTES) throw new Error("Too large");
      const contents = await file.text();
      const parsed = parseScheduleImport(contents);
      if (parsed.some(row => !classes.some(item => item.id === row.class_id) || !subjects.some(item => item.id === row.subject_id))) throw new Error("Unknown reference");
      if (current === generation.current) { setRaw(contents); setRows(parsed); }
    } catch { if (current === generation.current) setFailed(true); }
  }
  return <section className="mt-12 border-t border-[var(--line)] pt-6" aria-labelledby="import-title">
    <h2 id="import-title" className="section-title">{t.importTitle}</h2>
    <p id="import-hint" className="my-4 text-sm text-[var(--muted)]">{t.importHint}</p>
    <label><span className="field-label">{t.importFile}</span><input className="field" type="file" accept=".json,application/json"
      aria-describedby="import-hint" onChange={event => void choose(event.target.files?.[0])}/></label>
    {failed && <p className="form-error my-4" role="alert">{t.importInvalid}</p>}
    {!!rows.length && <><p className="my-4" role="status">{t.importPreview}: {rows.length}</p>
      <div className="my-4 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label={t.importPreview}><table className="w-full text-left text-sm">
        <caption className="sr-only">{t.importPreview}</caption>
        <thead><tr>{[t.date, t.class, t.lesson, t.subject, t.teacher, t.room].map(label => <th scope="col" className="p-2" key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.class_id + row.date + row.lesson_number} className="border-t border-[var(--line)]">
          {[row.date, classes.find(item => item.id === row.class_id)?.name, row.lesson_number, subjectName(subjectsById.get(row.subject_id), locale), row.teacher ?? "—", normalizeRoom(row.room)].map((cell, i) => <td className="p-2" key={i}>{cell}</td>)}
        </tr>)}</tbody>
      </table></div>
      <ActionForm key={raw} action={action} label={t.importSubmit}>
        <input type="hidden" name="schedule_json" value={raw}/>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirm_permission" required className="mt-1"/>{t.importConfirm}</label>
      </ActionForm></>}
    <details className="mt-6"><summary className="cursor-pointer">{t.importIds}</summary>
      <ul className="mt-3 space-y-2 break-all text-sm">{classes.map(item => <li key={item.id}>{item.name}: <code>{item.id}</code></li>)}
        {subjects.map(item => <li key={item.id}>{subjectName(item, locale)}: <code>{item.id}</code></li>)}</ul>
    </details>
  </section>;
}
