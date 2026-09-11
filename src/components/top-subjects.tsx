"use client";

import { useState } from "react";
import { useI18n } from "./locale-provider";
import { subjectName } from "@/lib/i18n";
import type { SubjectRow } from "@/lib/database.types";

export function TopSubjects({ subjects, initial }: { subjects: SubjectRow[]; initial: string[] }) {
  const { t, locale } = useI18n();
  const [values, setValues] = useState(() => Array.from({ length: 4 }, (_, index) =>
    subjects.some(subject => subject.id === initial[index]) && initial.indexOf(initial[index]) === index ? initial[index] : ""));
  const [duplicate, setDuplicate] = useState(false);
  return <fieldset className="space-y-3">
    <legend className="section-title mb-3">Top 4</legend>
    <p className="text-sm text-[var(--muted)]">{t.topHint}</p>
    <div className="grid gap-4 sm:grid-cols-2">{values.map((value, index) =>
      <label key={index}><span className="field-label">{t.subject} {index + 1}</span>
        <select className="field" name="subjects" value={value} onChange={event => {
          const next = event.target.value;
          const conflict = !!next && values.some((selected, position) => position !== index && selected === next);
          setDuplicate(conflict);
          if (!conflict) setValues(previous => previous.map((selected, position) => position === index ? next : selected));
        }}>
          <option value="">{t.notSelected}</option>
          {subjects.map(subject => <option key={subject.id} value={subject.id}
            disabled={subject.id !== value && values.includes(subject.id)}>{subjectName(subject, locale)}</option>)}
        </select>
      </label>)}</div>
    {duplicate && <p className="form-error" role="alert">{t.topDuplicate}</p>}
  </fieldset>;
}
