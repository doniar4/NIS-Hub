"use server";
import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { ManualScheduleSource } from "@/lib/schedule-source";
import type { ActionState } from "@/lib/action-state";
export async function importSchedule(_state: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  try {
    const { supabase } = await actionContext(true);
    const raw = form.get("schedule_json");
    if (typeof raw !== "string" || form.get("confirm_permission") !== "on") return { error: t.importInvalid };
    let source: ManualScheduleSource;
    try { source = new ManualScheduleSource(raw); } catch { return { error: t.importInvalid }; }
    const { error } = await supabase.rpc("import_schedule", { p_lessons: source.entries });
    if (error) return { error: t.importError };
  } catch { return { error: t.adminSession }; }
  revalidatePath("/admin"); revalidatePath("/schedule"); revalidatePath("/");
  return { success: t.importSaved };
}
