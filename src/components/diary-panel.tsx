"use client";
import { useState } from "react";
import { ReaderIcon, UploadIcon } from "@radix-ui/react-icons";
import {
  averagePercent,
  demoGrades,
  DIARY_MAX_BYTES,
  type Grade,
} from "@/lib/diary";
import { communityCopy } from "@/lib/community-copy";
import { useI18n } from "./locale-provider";
export function DiaryPanel() {
  const { locale } = useI18n(),
    p = communityCopy(locale),
    [imported, setImported] = useState<Grade[] | null>(null),
    [subject, setSubject] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const grades = imported ?? demoGrades(locale),
    subjects = [...new Set(grades.map((g) => g.subject))],
    selected = subjects.includes(subject) ? subject : "",
    rows = selected ? grades.filter((g) => g.subject === selected) : grades,
    average = averagePercent(rows);
  return (
    <div className="diary-layout">
      <section className="surface-card diary-import">
        <ReaderIcon className="diary-icon" aria-hidden="true" />
        <h2 className="section-title">{p.demo}</h2>
        <p>{p.demoHint}</p>
        <p className="text-sm">{p.importHint}</p>
        <label className="diary-upload">
          <UploadIcon aria-hidden="true" />
          <span>{busy ? p.loading : p.importFile}</span>
          <input
            type="file"
            accept=".html,.htm,.csv,.tsv,text/html,text/csv,text/tab-separated-values"
            disabled={busy}
            onChange={async (event) => {
              const input = event.currentTarget,
                file = input.files?.[0];
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                if (file.size > DIARY_MAX_BYTES) throw new Error("limit");
                const { parseDiary } = await import("@/lib/diary");
                setImported(parseDiary(await file.text()));
                setSubject("");
              } catch {
                setError(p.badImport);
              } finally {
                setBusy(false);
                input.value = "";
              }
            }}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            className="text-link"
            disabled={busy}
            onClick={() => {
              setImported(null);
              setSubject("");
              setError("");
            }}
          >
            {p.sample}
          </button>
          <button
            className="text-link"
            disabled={busy}
            onClick={() => {
              setImported([]);
              setSubject("");
              setError("");
            }}
          >
            {p.clear}
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="diary-source" role="status">
          {imported === null ? p.demo : p.imported}: {grades.length}{" "}
          {p.importedCount.toLocaleLowerCase()}
        </p>
      </section>
      <section className="diary-results">
        <div className="diary-overview surface-card">
          <div>
            <span>{p.average}</span>
            <strong>
              {average === null
                ? "-"
                : new Intl.NumberFormat(locale, {
                    maximumFractionDigits: 1,
                  }).format(average) + "%"}
            </strong>
            <p>{p.notOfficial}</p>
          </div>
          <label>
            <span className="field-label">{p.subject}</span>
            <select
              className="field"
              value={selected}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">{p.quarter}</option>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <section className="surface-card diary-table-panel">
          <h2 className="section-title">{p.results}</h2>
          {!rows.length ? (
            <p className="py-8">{p.noGrades}</p>
          ) : (
            <div
              className="diary-table-scroll"
              tabIndex={0}
              role="region"
              aria-label={p.results}
            >
              <table className="diary-table">
                <thead>
                  <tr>
                    {[p.subject, p.type, p.date, p.score].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...rows]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((g, index) => (
                      <tr key={`${g.subject}-${g.date}-${index}`}>
                        <th scope="row">{g.subject}</th>
                        <td>{g.type || "-"}</td>
                        <td>
                          <time dateTime={g.date}>
                            {new Intl.DateTimeFormat(locale, {
                              day: "numeric",
                              month: "short",
                              timeZone: "UTC",
                            }).format(new Date(g.date))}
                          </time>
                        </td>
                        <td>
                          <span className="grade-score">
                            {g.score}
                            <small> / {g.max}</small>
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
