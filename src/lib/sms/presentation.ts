import type { SmsAssessment, SmsSubjectSummary } from "./types";

export type AssessmentCounts = {
  works: number;
  sor: number;
  soch: number;
};

/**
 * Returns the assessment totals displayed on a diary subject card.  A loaded
 * subject detail is more complete than the snapshot, so it takes precedence.
 */
export function assessmentCounts(
  subject: SmsSubjectSummary,
  detail?: SmsAssessment[],
): AssessmentCounts {
  const assessments = detail ?? subject.assessments;

  return assessments.reduce<AssessmentCounts>(
    (counts, assessment) => {
      counts.works += 1;
      if (assessment.type === "sor") counts.sor += 1;
      if (assessment.type === "soch") counts.soch += 1;
      return counts;
    },
    { works: 0, sor: 0, soch: 0 },
  );
}
