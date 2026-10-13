import type { ClassHomework } from "@/lib/database.types";
import { useI18n } from "./locale-provider";
import { v053Copy } from "@/lib/v053-copy";

import { homeworkKind, homeworkBody } from "@/lib/homework-kind";
import { AssessmentBadge } from "./assessment-badge";

export function InlineLessonHomework({ rows, subject }: { rows: ClassHomework[]; subject: string }) {
  const { locale } = useI18n(), p = v053Copy(locale);
  if (!rows.length) return null;
  const hasSor = rows.some(row => homeworkKind(row) === "sor");
  return <details className="lesson-inline-homework">
    <summary aria-label={`${p.homework}: ${subject} (${rows.length}). ${p.homeworkExpand}`}>
      <span className="lesson-homework-label"><span className="lesson-homework-kinds">{hasSor && <AssessmentBadge kind="sor" locale={locale} />}{(!hasSor || rows.some(row => homeworkKind(row) === "homework")) && <span>{p.homeworkShort}</span>}{rows.length > 1 && <span> · {rows.length}</span>}</span><span className="lesson-homework-toggle" aria-hidden="true">⌄</span></span>
      <span className="lesson-homework-preview">{homeworkBody(rows[0], locale)}</span>
      <span className="sr-only">{p.homeworkExpand}</span>
    </summary>
    <ul className="lesson-homework-full" aria-label={p.homework} tabIndex={0}>
      {rows.map(row => <li key={row.id}>{homeworkKind(row) === "sor" && <AssessmentBadge kind="sor" locale={locale} />}<span>{homeworkBody(row, locale)}</span></li>)}
    </ul>
  </details>;
}
