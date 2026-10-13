"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { schoolCopy } from "@/lib/school-copy";
import { validSchoolSelection } from "@/lib/schools";
import type { ActionState } from "@/lib/action-state";
import { saveProfile } from "./profile";

export async function saveSchool(input: unknown): Promise<ActionState> {
  const { locale } = await getI18n(), p = schoolCopy(locale);
  const parsed = z.object({ city: z.string().max(40), school: z.string().max(60) }).strict()
    .refine(value => validSchoolSelection(value.city, value.school)).safeParse(input);
  if (!parsed.success) return { error: p.invalid };
  try {
    const { supabase, user } = await actionContext();
    const result = await supabase.rpc("save_profile_school", { p_city: parsed.data.city, p_school: parsed.data.school });
    if (result.error) return { error: ["42883", "PGRST202"].includes(result.error.code) ? p.migration : p.error };
    const saved = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
    if (saved.error || saved.data.school_id !== parsed.data.school) return { error: p.error };
    revalidatePath("/", "layout");
    return { success: p.saved };
  } catch { return { error: p.error }; }
}

export async function finishSchoolOnboarding(state: ActionState, form: FormData): Promise<ActionState> {
  const { locale } = await getI18n(), p = schoolCopy(locale);
  const result = await saveProfile(state, form);
  if (result.error) return result;
  try {
    const { supabase, user } = await actionContext();
    const completed = await supabase.rpc("complete_profile_onboarding", {});
    if (completed.error) return { error: p.profileError };
    const saved = await supabase.from("profiles").select("school_id,onboarding_completed_at").eq("id", user.id).single();
    if (saved.error || !saved.data.school_id || !saved.data.onboarding_completed_at) return { error: p.profileError };
    revalidatePath("/", "layout");
    return { success: p.saved };
  } catch { return { error: p.profileError }; }
}
