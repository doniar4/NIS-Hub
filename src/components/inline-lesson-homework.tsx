import type { ClassHomework } from "@/lib/database.types";
import { useI18n } from "./locale-provider";
import { v053Copy } from "@/lib/v053-copy";

export function InlineLessonHomework({ rows, subject }: { rows: ClassHomework[]; subject: string }) {
  const { locale } = useI18n(), p = v053Copy(locale);
  if (!rows.length) return null;
  return <details className="lesson-inline-homework">
    <summary aria-label={`${p.homework}: ${subject} (${rows.length}). ${p.homeworkExpand}`}>
      <span className="lesson-homework-label"><span>{p.homeworkShort}{rows.length > 1 && ` · ${rows.length}`}</span><span className="lesson-homework-toggle" aria-hidden="true">⌄</span></span>
      <span className="lesson-homework-preview">{rows[0].body}</span>
      <span className="sr-only">{p.homeworkExpand}</span>
    </summary>
    <ul className="lesson-homework-full" aria-label={p.homework} tabIndex={0}>
      {rows.map(row => <li key={row.id}>{row.body}</li>)}
    </ul>
  </details>;
}
