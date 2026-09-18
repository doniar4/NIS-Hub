"use server";
import { communityCopy } from "@/lib/community-copy";
import { getI18n } from "@/lib/i18n-server";
import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/auth";
import { profileSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
export async function saveProfile(_state: ActionState, form: FormData): Promise<ActionState> {
    const { t, locale } = await getI18n();
    const parsed = profileSchema.safeParse({ display_name: form.get("display_name"), class_id: form.get("class_id"), subjects: form.getAll("subjects").filter(Boolean) });
    if (!parsed.success)
        return { error: t.invalidInput };
    try {
        const { supabase } = await actionContext();
        const { error } = await supabase.rpc("save_profile", { p_name: parsed.data.display_name, p_class: parsed.data.class_id, p_subjects: parsed.data.subjects });
        if (error)
            return { error: error.code === "23505" ? communityCopy(locale).nameTaken : t.saveError };
    }
    catch {
        return { error: t.sessionError };
    }
    revalidatePath("/profile");
    revalidatePath("/");
    return { success: t.profileSaved };
}
