"use server";
import { getI18n } from "@/lib/i18n-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, safeNext } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
export async function authenticate(mode: "login" | "signup", _state: ActionState, form: FormData): Promise<ActionState> {
    const { t } = await getI18n();
    if (mode !== "login" && mode !== "signup")
        return { error: t.invalidInput };
    const parsed = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success)
        return { error: t.invalidInput };
    if (mode === "signup" && form.get("terms") !== "on")
        return { error: t.termsRequired };
    try {
        const supabase = await createClient(true);
        if (!supabase)
            return { error: t.authNotConfigured };
        const result = mode === "signup"
            ? await supabase.auth.signUp(parsed.data)
            : await supabase.auth.signInWithPassword(parsed.data);
        if (result.error) {
            if (result.error.status === 429)
                return { error: t.tooManyAttempts };
            if (result.error.code === "email_not_confirmed")
                return { error: t.confirmEmail };
            return { error: mode === "login" ? t.loginError : t.signupError };
        }
        if (mode === "signup" && !result.data.session)
            return { success: t.checkEmail };
    }
    catch {
        return { error: t.saveError };
    }
    revalidatePath("/", "layout");
    redirect(safeNext(form.get("next")));
}
export async function logout(_state: ActionState, _form: FormData): Promise<ActionState> {
    const { t } = await getI18n();
    void _state;
    void _form;
    const supabase = await createClient(true);
    if (supabase) {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error)
            return { error: t.logoutError };
    }
    revalidatePath("/", "layout");
    redirect("/login");
}
