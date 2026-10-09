"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./locale-provider";
import { subjectName } from "@/lib/i18n";
import type { SubjectRow } from "@/lib/database.types";
import { SubjectMotif } from "./subject-motif";

export function TopSubjects({ subjects, initial }: { subjects: SubjectRow[]; initial: string[] }) {
  const { t, locale } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [values, setValues] = useState(() => Array.from({ length: 4 }, (_, index) =>
    subjects.some(subject => subject.id === initial[index]) && initial.indexOf(initial[index]) === index ? initial[index] : ""));
  const copy = locale === "ru"
    ? { choose: "Выбрать", change: "Изменить", remove: "Убрать", dialog: "Выберите предмет", dialogHint: "Предмет появится в этой позиции вашего профиля." }
    : { choose: "Choose", change: "Change", remove: "Remove", dialog: "Choose a subject", dialogHint: "The subject will be shown in this position on your profile." };
  const root = useRef<HTMLFieldSetElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    // Hidden inputs do not emit events; notify the enclosing form (autosave/dirty state).
    if (firstRender.current) { firstRender.current = false; return; }
    root.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [values]);
  const openPicker = (index: number) => {
    setActiveSlot(index);
    dialog.current?.showModal();
  };
  const chooseSubject = (id: string) => {
    if (activeSlot === null) return;
    setValues((current) => {
      const next = [...current];
      const existing = next.indexOf(id);
      if (existing >= 0 && existing !== activeSlot) next[existing] = "";
      next[activeSlot] = id;
      return next;
    });
    dialog.current?.close();
  };
  return <fieldset ref={root} className="space-y-3">
    <legend className="section-title mb-3">Top 4</legend>
    <p className="text-sm text-[var(--muted)]">{t.topHint}</p>
    {values.map((value, index) => <input key={index} type="hidden" name="subjects" value={value}/>) }
    <div className="top-subject-slots">
      {values.map((value, index) => {
        const subject = subjects.find(item => item.id === value);
        return <div className="top-subject-slot" key={index}>
          {subject ? <SubjectMotif subject={subject}/> : <span className="top-subject-placeholder" aria-hidden="true">{index + 1}</span>}
          <div className="top-subject-slot-copy">
            <small>{t.subject} {index + 1}</small>
            <strong>{subject ? subjectName(subject, locale) : copy.choose}</strong>
          </div>
          <button type="button" className="top-subject-edit" onClick={() => openPicker(index)}>{subject ? copy.change : copy.choose}</button>
          {subject && <button type="button" className="top-subject-remove" aria-label={`${copy.remove}: ${subjectName(subject, locale)}`} onClick={() => setValues(current => current.map((item, itemIndex) => itemIndex === index ? "" : item))}>×</button>}
        </div>;
      })}
    </div>
    <dialog ref={dialog} className="top-subject-dialog" aria-labelledby="top-subject-dialog-title" onClose={() => setActiveSlot(null)}>
      <div className="top-subject-dialog-header">
        <div>
          <p className="eyebrow">Top 4 · {activeSlot === null ? "" : activeSlot + 1}</p>
          <h2 id="top-subject-dialog-title">{copy.dialog}</h2>
          <p>{copy.dialogHint}</p>
        </div>
        <button type="button" className="icon-button" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
      </div>
      <div className="top-subject-modal-grid">
        {subjects.map(subject => <button key={subject.id} type="button" className="top-subject-modal-option" onClick={() => chooseSubject(subject.id)}>
          <SubjectMotif subject={subject}/>
          <span>{subjectName(subject, locale)}</span>
        </button>)}
      </div>
    </dialog>
  </fieldset>;
}
