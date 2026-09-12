"use server";
import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/auth";
import { getWeeklySchedule } from "@/lib/weekly-queries";
import { getCatalogOptions } from "@/lib/queries";
import { getI18n } from "@/lib/i18n-server";
import { phase4Copy } from "@/lib/phase4-copy";
import { parseTimetable } from "@/lib/timetable-import";
import type { ActionState } from "@/lib/action-state";
export async function importWeeklySchedule(_state: ActionState, form: FormData): Promise<ActionState> {
  const { locale } = await getI18n(); const t = phase4Copy(locale);
  try {
    const { supabase } = await actionContext(true);
    const raw = form.get("timetable");
    if (typeof raw !== "string" || form.get("confirm") !== "on") return { error: t.format };
    const { classes, subjects } = await getCatalogOptions();
    const parsed = parseTimetable(raw,classes,subjects,await getWeeklySchedule());
    if (parsed.issues.length) return { error: parsed.issues.map(issue => t.row+" "+issue.row+": "+t[issue.code]).join("\n") };
    // Repeat validation server-side; PostgreSQL enforces FK, overlap and atomicity
    // against the current rows, including concurrent administrator imports.
    const { error } = await supabase.rpc("import_weekly_schedule", { p_lessons: parsed.lessons });
    if (error) return { error: t.importError };
  } catch { return { error: t.importError }; }
  revalidatePath("/","layout");
  return { success: t.importSaved };
}
