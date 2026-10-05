"use client";
import { useState, useTransition } from "react";
import {
  saveHomework,
  deleteHomework,
} from "@/app/actions/homework";
import type { ClassHomework, SubjectRow } from "@/lib/database.types";
import type { CommunityError } from "@/lib/people";
import { subjectName } from "@/lib/i18n";
import { v053Copy } from "@/lib/v053-copy";
import { useI18n } from "./locale-provider";
import { SafetyMenu } from "./safety-menu";
import { TelegramHomeworkCta, TelegramHomeworkLink } from "./telegram-homework-cta";
import { useHomeworkDay } from "./day-homework-provider";
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
    [error, setError] = useState<CommunityError | null>(null),
    [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0),
    [pending, start] = useTransition(),
    [edit, setEdit] = useState<ClassHomework | null>(null);
  const day=useHomeworkDay(date,hasClass),loading=day.loading,rows=day.rows.slice(offset,offset+20);
  const displayedError=error??day.error;
  function reload() {
    setError(null);
    setRevision((v) => v + 1);
    window.dispatchEvent(new Event("nis-homework-change"));
  }
  return (
    <section className="surface-card space-y-5 mt-8 homework-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">{p.homework}</h2>
        <TelegramHomeworkLink locale={locale} compact />
      </div>
      <p>{p.homeworkHint}</p>
      <TelegramHomeworkCta locale={locale} />
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
                  setError(null);
                  setDate(e.target.value);
                  setOffset(0);
                  setEdit(null);
                }
              }}
            />
          </label>
          {displayedError && <p role="alert">{p[displayedError]}</p>}
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
                            if ("error" in r) setError(r.error);
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
            {!loading && !rows.length && !displayedError && <p>{p.none}</p>}
          </div>
          {(offset > 0 || rows.length >= 20) && (
            <div className="flex flex-wrap gap-2">
              <button
                className="button button-secondary"
                disabled={!offset || loading}
                onClick={() => {
                  setOffset((v) => v - 20);
                }}
              >
                {p.previous}
              </button>
              <button
                className="button button-secondary"
                disabled={offset+20>=day.rows.length || loading || offset >= 10000}
                onClick={() => {
                  setOffset((v) => v + 20);
                }}
              >
                {p.more}
              </button>
            </div>
          )}
          <form
            key={(edit?.id ?? "new") + date + revision}
            className="homework-form-surface p-5 rounded-2xl border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] backdrop-blur-md space-y-4"
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
                if ("error" in r) setError(r.error);
                else {
                  setEdit(null);
                  reload();
                }
              });
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--glass-divider)]">
              <span className="font-semibold text-sm text-[var(--accent)]">
                {edit ? (locale === "kk" ? "Тапсырманы өңдеу" : locale === "en" ? "Edit assignment" : "Редактирование задания") : (locale === "kk" ? "Жаңа үй тапсырмасы" : locale === "en" ? "New assignment" : "Новое домашнее задание")}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {date}
              </span>
            </div>

            <label className="block">
              <span className="field-label">{t.subject}</span>
              <select
                className="field w-full"
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

            <label className="block">
              <span className="field-label">{p.body}</span>
              <textarea
                className="field w-full"
                rows={3}
                name="body"
                required
                maxLength={1000}
                placeholder={locale === "kk" ? "Үй тапсырмасын, параграф немесе жаттығу нөмірлерін жазыңыз..." : locale === "en" ? "Describe homework, exercises, page numbers..." : "Опишите домашнее задание (номера упражнений, параграф, ссылки)..."}
                defaultValue={edit?.body ?? ""}
              />
            </label>

            <div className="flex items-center justify-end gap-3 pt-2">
              {edit && (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setEdit(null)}
                >
                  {p.cancel}
                </button>
              )}
              <button className="button" disabled={pending}>
                {pending ? (locale === "kk" ? "Сақталуда..." : locale === "en" ? "Saving..." : "Сохранение...") : p.save}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
