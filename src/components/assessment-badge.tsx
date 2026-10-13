import type { Locale } from "@/lib/i18n";
import { homeworkKindCopy } from "@/lib/homework-kind";

export function AssessmentBadge({ kind, locale }: { kind: "sor" | "soch"; locale: Locale }) {
  return <span className="assessment-badge" data-kind={kind}>
    <span className="assessment-badge-dot" aria-hidden="true" />{homeworkKindCopy(locale)[kind]}
  </span>;
}
