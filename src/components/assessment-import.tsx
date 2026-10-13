"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewAssessmentSchedule,
  importAssessmentSchedule,
  clearAssessmentSchedule,
} from "@/app/actions/assessments";
import {
  ASSESSMENT_BYTES,
  type AssessmentPreview,
} from "@/lib/assessment-contract";
import { assessmentCopy } from "@/lib/assessment-copy";
import type { ClassRow, AssessmentPeriodRow } from "@/lib/database.types";
import type { ActionState } from "@/lib/action-state";
import { formatSchoolDate } from "@/lib/school-calendar";
import { useI18n } from "./locale-provider";

export function AssessmentImport({
  classes,
  dates,
  available,
  periods = [],
}: {
  classes: ClassRow[];
  dates: string[];
  available: boolean;
  periods?: AssessmentPeriodRow[];
}) {
  const { locale, t } = useI18n(),
    c = assessmentCopy(locale),
    router = useRouter();
  const [file, setFile] = useState<File>(),
    [year, setYear] = useState(""),
    [quarter, setQuarter] = useState(""),
    [expectedRevision, setExpectedRevision] = useState<string | null>(null);
  const [preview, setPreview] = useState<AssessmentPreview>(),
    [state, setState] = useState<ActionState>({});
  const [confirmed, setConfirmed] = useState(false),
    [pending, start] = useTransition();
  const [removeDates, setRemoveDates] = useState<string[]>([]),
    [clearConfirmed, setClearConfirmed] = useState(false);
  const revision = useRef(0);
  const reset = () => {
    revision.current++;
    setPreview(undefined);
    setConfirmed(false);
    setExpectedRevision(null);
    setState({});
  };
  const form = () => {
    const data = new FormData();
    if (file) data.set("file", file);
    data.set("academic_year", year);
    data.set("quarter", quarter);
    data.set("expected_revision", expectedRevision ?? "");
    return data;
  };
  const previewDates = [...new Set(preview?.days.map((d) => d.date))].sort();
  const classIds = new Set(preview?.days.map((d) => d.class_id));
  return (
    <section
      className="mt-10 space-y-5"
      aria-labelledby="assessment-import-title"
    >
      <h2 id="assessment-import-title" className="section-title">
        {c.title}
      </h2>
      <p className="text-sm text-[var(--muted)]">{c.hint}</p>
      <a
        className="text-link"
        href="/templates/quarter-assessments.xlsx"
        download
      >
        {c.sample}
      </a>
      {!available && <p role="status">{c.migration}</p>}
      <fieldset disabled={pending || !available} className="min-w-0 space-y-5">
        <label className="block">
          <span className="field-label">{c.file}</span>
          <input
            className="field"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              reset();
              const next = event.target.files?.[0];
              setFile(next);
              setYear("");
              setQuarter("");
              if (next && next.size > ASSESSMENT_BYTES) {
                setFile(undefined);
                setState({ error: c.limit });
              }
            }}
          />
        </label>
        <label className="block">
          <span className="field-label">{c.schoolYear}</span>
          <input
            className="field"
            type="number"
            min="2000"
            max="2100"
            value={year}
            placeholder={c.auto}
            onChange={(event) => {
              reset();
              setYear(event.target.value);
            }}
          />
        </label>
        <label className="block">
          <span className="field-label">{c.quarter}</span>
          <select
            className="field"
            value={quarter}
            onChange={(e) => {
              reset();
              setQuarter(e.target.value);
            }}
          >
            <option value="">{c.auto}</option>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button button-secondary"
          disabled={!file}
          onClick={() => {
            const version = revision.current;
            setState({});
            start(async () => {
              try {
                const result = await previewAssessmentSchedule(form());
                if (version === revision.current) {
                  setPreview(result.preview);
                  setExpectedRevision(result.expectedRevision ?? null);
                  if (result.preview?.period) {
                    setYear(String(result.preview.period.academic_year));
                    setQuarter(String(result.preview.period.quarter));
                  }
                  setConfirmed(false);
                  setState({ error: result.error });
                }
              } catch {
                if (version === revision.current) setState({ error: c.format });
              }
            });
          }}
        >
          {pending ? t.loading : c.preview}
        </button>
        {preview && (
          <div className="space-y-4">
            {preview.period && (
              <p>
                <strong>
                  {preview.period.academic_year}–
                  {preview.period.academic_year + 1} · {c.quarter}{" "}
                  {preview.period.quarter}
                </strong>
              </p>
            )}
            <p role="status">
              {c.count}: {preview.lessons.length}. {c.classes}:{" "}
              {classes
                .filter((item) => classIds.has(item.id))
                .map((item) => item.name)
                .join(", ")}
            </p>
            <p>
              {c.dates}:{" "}
              {previewDates
                .map((date) => formatSchoolDate(date, locale))
                .join("; ")}
            </p>
            <div
              className="max-h-96 overflow-auto"
              data-lenis-prevent
              tabIndex={0}
              role="region"
              aria-label={c.preview}
            >
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{c.title}</caption>
                <thead>
                  <tr>
                    {[t.class, t.date, t.lesson, t.subject].map((label) => (
                      <th key={label} scope="col" className="p-2">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.lessons.map((row, i) => (
                    <tr key={i} className="border-t border-[var(--line)]">
                      <td className="p-2">
                        {classes.find((cl) => cl.id === row.class_id)?.name}
                      </td>
                      <td className="p-2">
                        {formatSchoolDate(row.date, locale)}
                      </td>
                      <td className="p-2">
                        {row.lesson_start}–{row.lesson_end}
                      </td>
                      <td className="p-2">
                        {row.subject_label}
                        {row.duration_minutes
                          ? ` (${row.duration_minutes} ${c.minutes})`
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              {c.confirm}
            </label>
            <button
              type="button"
              className="button"
              disabled={!confirmed}
              onClick={() =>
                start(async () => {
                  const data = form();
                  data.set("confirm", "on");
                  try {
                    const result = await importAssessmentSchedule({}, data);
                    setState(result);
                    setConfirmed(false);
                    if (result.success) {
                      setPreview(undefined);
                      router.refresh();
                    }
                  } catch {
                    setState({ error: c.error });
                  }
                })
              }
            >
              {pending ? t.saving : c.publish}
            </button>
          </div>
        )}
        {!!periods.length && (
          <div className="space-y-2">
            <h3>{c.active}</h3>
            {periods.map((p) => (
              <p key={p.id}>
                {p.academic_year}–{p.academic_year + 1} · {c.quarter}{" "}
                {p.quarter} · {p.source_file}
              </p>
            ))}
          </div>
        )}
        {!!dates.length && (
          <details>
            <summary>
              {c.active} ({dates.length})
            </summary>
            <div className="mt-4 space-y-4">
              {dates.map((date) => (
                <label className="flex items-center gap-3" key={date}>
                  <input
                    type="checkbox"
                    checked={removeDates.includes(date)}
                    onChange={(e) => {
                      setClearConfirmed(false);
                      setRemoveDates((previous) =>
                        e.target.checked
                          ? [...previous, date]
                          : previous.filter((d) => d !== date),
                      );
                    }}
                  />
                  {formatSchoolDate(date, locale)}
                </label>
              ))}
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={clearConfirmed}
                  onChange={(e) => setClearConfirmed(e.target.checked)}
                />
                {c.clear}
              </label>
              <button
                className="button button-secondary"
                type="button"
                disabled={!removeDates.length || !clearConfirmed}
                onClick={() =>
                  start(async () => {
                    const data = new FormData();
                    removeDates.forEach((date) => data.append("dates", date));
                    data.set("confirm", "on");
                    try {
                      const result = await clearAssessmentSchedule({}, data);
                      setState(result);
                      if (result.success) {
                        setRemoveDates([]);
                        setClearConfirmed(false);
                        router.refresh();
                      }
                    } catch {
                      setState({ error: c.error });
                    }
                  })
                }
              >
                {c.clear}
              </button>
            </div>
          </details>
        )}
      </fieldset>
      {state.error && (
        <p role="alert" className="form-error whitespace-pre-line">
          {state.error}
        </p>
      )}
      {state.success && <p role="status">{state.success}</p>}
    </section>
  );
}
