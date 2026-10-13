"use server";
import { communityCopy } from "@/lib/community-copy";
import { getI18n } from "@/lib/i18n-server";
import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/auth";
import { profileSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
export async function saveProfile(_state: ActionState, form: FormData): Promise<ActionState> {
    const { t, locale } = await getI18n();
    const parsed = profileSchema.safeParse({ bio: form.get("bio") ?? "", display_name: form.get("display_name"), class_id: form.get("class_id"), subjects: form.getAll("subjects").filter(Boolean) });
    if (!parsed.success)
        return { error: t.invalidInput };
    try {
        const { supabase, user } = await actionContext();
        const { error } = await supabase.rpc("save_profile_v053", { p_bio: parsed.data.bio, p_name: parsed.data.display_name, p_class: parsed.data.class_id, p_subjects: parsed.data.subjects });
        if (error)
            return { error: error.code === "23505" ? communityCopy(locale).nameTaken : t.saveError };
        // An RPC returning void must not be treated as proof that a row changed.
        const [saved, top] = await Promise.all([
            supabase.from("profiles").select("display_name,class_id,bio").eq("id", user.id).single(),
            supabase.from("profile_top_subjects").select("subject_id").eq("profile_id", user.id).order("position"),
        ]);
        if (saved.error || top.error || saved.data.display_name !== parsed.data.display_name
            || saved.data.class_id !== parsed.data.class_id || (saved.data.bio ?? "") !== parsed.data.bio
            || JSON.stringify(top.data.map(row => row.subject_id)) !== JSON.stringify(parsed.data.subjects))
            return { error: t.saveError };
    }
    catch {
        return { error: t.sessionError };
    }
    revalidatePath("/", "layout");
    return { success: t.profileSaved };
}
