"use client";
import { useEffect, useState, useTransition } from "react";
import {
  loadHomework,
  saveHomework,
  deleteHomework,
} from "@/app/actions/homework";
import type { ClassHomework, SubjectRow } from "@/lib/database.types";
import type { CommunityError } from "@/lib/people";
import { subjectName } from "@/lib/i18n";
import { v053Copy } from "@/lib/v053-copy";
import { useI18n } from "./locale-provider";
import { SafetyMenu } from "./safety-menu";
export function ClassHomeworkPanel({
  userId,
  date: initialDate,
  subjects,
  hasClass,
}: {
  userId: string;
  date: string;
  subjects: SubjectRow[];
  hasClass: boolean;
}) {
  const { locale, t } = useI18n(),
    p = v053Copy(locale);
  const [date, setDate] = useState(initialDate),
    [rows, setRows] = useState<ClassHomework[]>([]),
    [error, setError] = useState<CommunityError | null>(null),
    [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0),
    [pending, start] = useTransition(),
    [loading, setLoading] = useState(hasClass),
    [edit, setEdit] = useState<ClassHomework | null>(null);
  useEffect(() => {
    if(!hasClass)return;
    let active = true;
    void loadHomework(date, offset).then((r) => {
      if (!active) return;
      if ("error" in r) {setError(r.error);setRows([]);}
      else {
        setRows(r.data);
        setError(null);
      }
      setLoading(false);
    }).catch(()=>{if(active){setRows([]);setError("failed");setLoading(false);}});
    return () => {
      active = false;
    };
  }, [date, offset, revision, hasClass]);
  useEffect(() => {
    const refresh = () => {
      setLoading(true);
      setRevision((v) => v + 1);
    };
    window.addEventListener("nis-homework-change", refresh);
    return () => window.removeEventListener("nis-homework-change", refresh);
  }, []);
  function reload() {
    setLoading(true);
    setRevision((v) => v + 1);
  }
  return (
    <section className="surface-card space-y-5 mt-8 homework-panel">
      <h2 className="section-title">{p.homework}</h2>
      <p>{p.homeworkHint}</p>
      {!hasClass ? (
        <p>{t.chooseProfileClass}</p>
      ) : (
        <>
          <label>
            <span className="field-label">{p.due}</span>
            <input
              className="field max-w-xs"
              type="date"
              required
              value={date}
              onChange={(e) => {
                if (e.target.value) {
                  setLoading(true);
                  setDate(e.target.value);
                  setOffset(0);
                  setEdit(null);
                }
              }}
            />
          </label>
          {error && <p role="alert">{p[error]}</p>}
          <div aria-busy={loading}>
            {rows.map((row) => (
              <article key={row.id} className="homework-entry">
                <h3>
                  {subjectName(
                    subjects.find((s) => s.id === row.subject_id),
                    locale,
                  )}
                </h3>
                <p className="whitespace-pre-wrap">{row.body}</p>
                <div className="flex flex-wrap gap-2">
                  {row.created_by === userId ? (
                    <>
                      <button
                        className="button button-secondary"
                        onClick={() => setEdit(row)}
                      >
                        {p.edit}
                      </button>
                      <button
                        className="button button-secondary"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await deleteHomework(row.id);
                            if ("error" in r) {setError(r.error);setRows([]);}
                            else reload();
                          })
                        }
                      >
                        {p.delete}
                      </button>
                    </>
                  ) : (
                    <SafetyMenu homework={row.id} />
                  )}
                </div>
              </article>
            ))}
            {!loading && !rows.length && !error && <p>{p.none}</p>}
          </div>
          {(offset > 0 || rows.length >= 20) && (
            <div className="flex flex-wrap gap-2">
              <button
                className="button button-secondary"
                disabled={!offset || loading}
                onClick={() => {
                  setLoading(true);
                  setOffset((v) => v - 20);
                }}
              >
                {p.previous}
              </button>
              <button
                className="button button-secondary"
                disabled={rows.length < 20 || loading || offset >= 10000}
                onClick={() => {
                  setLoading(true);
                  setOffset((v) => v + 20);
                }}
              >
                {p.more}
              </button>
            </div>
          )}
          <form
            key={(edit?.id ?? "new") + date + revision}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              start(async () => {
                const r = await saveHomework({
                  id: edit?.id ?? null,
                  subject: f.get("subject"),
                  date,
                  body: f.get("body"),
                });
                if ("error" in r) {setError(r.error);setRows([]);}
                else {
                  setEdit(null);
                  reload();
                }
              });
            }}
          >
            <label>
              <span className="field-label">{t.subject}</span>
              <select
                className="field"
                name="subject"
                required
                defaultValue={edit?.subject_id ?? ""}
              >
                <option value="">{t.notSelected}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {subjectName(s, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">{p.body}</span>
              <textarea
                className="field"
                rows={4}
                name="body"
                required
                maxLength={1000}
                defaultValue={edit?.body ?? ""}
              />
            </label>
            <button className="button" disabled={pending}>
              {p.save}
            </button>
            {edit && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setEdit(null)}
              >
                {p.cancel}
              </button>
            )}
          </form>
        </>
      )}
    </section>
  );
}
