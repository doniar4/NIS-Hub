"use server";
import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/queries";
import { getI18n } from "@/lib/i18n-server";
import { assessmentCopy } from "@/lib/assessment-copy";
import { parseAssessmentWorkbook } from "@/lib/assessment-import";
import {
  ASSESSMENT_BYTES,
  type AssessmentPreview,
} from "@/lib/assessment-contract";
import { dateSchema, uuid } from "@/lib/validation";
import { getAssessmentPeriods } from "@/lib/assessment-queries";
import type { ActionState } from "@/lib/action-state";

async function readFile(form: FormData) {
  const { locale } = await getI18n(),
    c = assessmentCopy(locale);
  const file = form.get("file"),
    year = form.get("academic_year"),
    quarter = form.get("quarter");
  if (
    !(file instanceof File) ||
    !file.size ||
    !file.name.toLowerCase().endsWith(".xlsx")
  )
    return { error: c.format };
  if (file.size > ASSESSMENT_BYTES) return { error: c.limit };
  const { classes, subjects } = await getCatalogOptions();
  const preview = await parseAssessmentWorkbook(
    await file.arrayBuffer(),
    classes,
    subjects,
    undefined,
    {
      academic_year:
        typeof year === "string" && year.trim() ? Number(year) : undefined,
      quarter:
        typeof quarter === "string" && quarter.trim()
          ? Number(quarter)
          : undefined,
    },
  );
  if (preview.issues.length)
    return {
      error: preview.issues
        .slice(0, 30)
        .map((issue) =>
          [issue.sheet, issue.row ? c.row + " " + issue.row : "", c[issue.code]]
            .filter(Boolean)
            .join(": "),
        )
        .join("\n"),
    };
  return { preview, source: file.name.slice(0, 255) };
}
export async function previewAssessmentSchedule(
  form: FormData,
): Promise<{
  preview?: AssessmentPreview;
  error?: string;
  expectedRevision?: string | null;
}> {
  const { locale } = await getI18n(),
    c = assessmentCopy(locale);
  try {
    await actionContext(true);
    const parsed = await readFile(form);
    if (!parsed.preview?.period) return parsed;
    const periods = await getAssessmentPeriods();
    if (!periods.available) return { error: c.migration };
    const active = periods.rows.find(
      (p) =>
        p.academic_year === parsed.preview!.period!.academic_year &&
        p.quarter === parsed.preview!.period!.quarter,
    );
    return { ...parsed, expectedRevision: active?.revision_id ?? null };
  } catch {
    return { error: c.format };
  }
}
export async function importAssessmentSchedule(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { locale } = await getI18n(),
    c = assessmentCopy(locale);
  try {
    const { supabase } = await actionContext(true);
    if (form.get("confirm") !== "on") return { error: c.format };
    // Reparse the original workbook against the current catalog; do not trust
    // the browser's preview or submitted IDs.
    const parsed = await readFile(form);
    if (!parsed.preview?.period) return { error: parsed.error ?? c.period };
    const expected = form.get("expected_revision");
    if (
      typeof expected !== "string" ||
      (expected && !uuid.safeParse(expected).success)
    )
      return { error: c.changed };
    const { error } = await supabase.rpc("import_quarter_assessments", {
      p_lessons: parsed.preview.lessons,
      p_days: parsed.preview.days,
      p_source_file: parsed.source!,
      p_academic_year: parsed.preview.period.academic_year,
      p_quarter: parsed.preview.period.quarter,
      p_expected_revision: expected || null,
    });
    if (error)
      return {
        error:
          error.code === "PGRST202"
            ? c.migration
            : error.message.includes("Assessment revision changed")
              ? c.changed
              : c.error,
      };
  } catch {
    return { error: c.error };
  }
  revalidatePath("/", "layout");
  return { success: c.saved };
}
export async function clearAssessmentSchedule(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { locale } = await getI18n(),
    c = assessmentCopy(locale);
  try {
    const { supabase } = await actionContext(true),
      dates = form.getAll("dates");
    if (
      form.get("confirm") !== "on" ||
      !dates.length ||
      dates.length > 100 ||
      dates.some((d) => !dateSchema.safeParse(d).success)
    )
      return { error: c.date };
    const { error } = await supabase.rpc("clear_assessment_schedule", {
      p_dates: dates as string[],
    });
    if (error) return { error: c.error };
  } catch {
    return { error: c.error };
  }
  revalidatePath("/", "layout");
  return { success: c.cleared };
}
