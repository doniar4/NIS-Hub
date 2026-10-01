"use server";
import { getI18n } from "@/lib/i18n-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, safeNext } from "@/lib/validation";
import { clearSmsSession } from "@/lib/sms/session";
import { absoluteSiteUrl, authCallbackUrl, getSiteOrigin } from "@/lib/site-url";
import { getSupabaseConfig } from "@/lib/env";
import { allowedSocialProvider, socialProviderEnabled } from "@/lib/auth-providers";
import { headers } from "next/headers";
import { markWelcomeComplete } from "@/lib/welcome-server";
import type { ActionState } from "@/lib/action-state";
export async function completeWelcome() {
    await markWelcomeComplete();
    redirect("/signup");
}
export async function authenticate(mode: "login" | "signup", _state: ActionState, form: FormData): Promise<ActionState> {
    const { t } = await getI18n();
    if (mode !== "login" && mode !== "signup")
        return { error: t.invalidInput };
    const parsed = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success)
        return { error: t.invalidInput };
    if (mode === "signup" && form.get("terms") !== "on")
        return { error: t.termsRequired };
    if (mode === "signup" && process.env.NODE_ENV === "production") {
        const host = (await headers()).get("host");
        if (host !== new URL(getSiteOrigin()).host) {
            redirect(absoluteSiteUrl("/?auth=signup") + "#welcome-auth");
        }
    }

    try {
        const supabase = await createClient(true);
        if (!supabase)
            return { error: t.authNotConfigured };
        const result = mode === "signup"
            ? await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: authCallbackUrl() } })
            : await supabase.auth.signInWithPassword(parsed.data);

        if (result.error) {
            // Safe diagnostics only: never log email, password, tokens,
            // cookies, headers, or the raw provider error object.
            console.warn("[auth] Supabase authentication failed", {
                mode,
                code: result.error.code ?? "unknown",
                status: result.error.status ?? 0,
            });

            if (result.error.status === 429)
                return { error: t.tooManyAttempts };
            if (result.error.code === "email_not_confirmed")
                return { error: t.confirmEmail };
            return { error: mode === "login" ? t.loginError : t.signupError };
        }

        if (mode === "login") {
            if (!result.data.session || !result.data.user) {
                console.warn("[auth] Supabase login returned no session", { mode });
                return { error: t.saveError };
            }

            const verification = await supabase.auth.getUser();
            if (verification.error || !verification.data.user) {
                console.warn("[auth] Supabase session verification failed", {
                    mode,
                    code: verification.error?.code ?? "missing_user",
                    status: verification.error?.status ?? 0,
                });
                return { error: t.saveError };
            }

            if (verification.data.user.id !== result.data.user.id) {
                console.warn("[auth] Supabase session user mismatch", { mode });
                return { error: t.saveError };
            }
        }

        await markWelcomeComplete();
        if (mode === "signup" && !result.data.session)
            return { success: t.checkEmail };
    }
    catch {
        return { error: t.saveError };
    }
    revalidatePath("/", "layout");
    redirect(safeNext(form.get("next")));
}
export async function startSocialSignIn(
    provider: string,
    _state: ActionState,
    _form: FormData,
): Promise<ActionState> {
    void _state;
    void _form;
    const { t } = await getI18n();
    if (!allowedSocialProvider(provider) || !socialProviderEnabled(provider)) {
        return { error: t.authNotConfigured };
    }
    const config = getSupabaseConfig();
    if (!config) return { error: t.authNotConfigured };

    // A PKCE verifier belongs to the origin that started OAuth. Never begin on
    // a Vercel preview and send its callback to the production cookie jar.
    if (process.env.NODE_ENV === "production") {
        const host = (await headers()).get("host");
        if (host !== new URL(getSiteOrigin()).host) {
            redirect(absoluteSiteUrl("/?auth=login") + "#welcome-auth");
        }
    }

    let destination: string;
    try {
        const supabase = await createClient(true);
        if (!supabase) return { error: t.authNotConfigured };
        const result = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: authCallbackUrl() },
        });
        if (result.error || !result.data.url) return { error: t.oauthError };
        const url = new URL(result.data.url);
        if (url.origin !== config.url || url.pathname !== "/auth/v1/authorize") return { error: t.oauthError };
        destination = url.toString();
    } catch {
        return { error: t.oauthError };
    }
    redirect(destination);
}
export async function logout(_state: ActionState, _form: FormData): Promise<ActionState> {
    const { t } = await getI18n();
    void _state;
    void _form;
    const supabase = await createClient(true);
    if (supabase) {
        // Clear the cookie before sign-out; a failed encrypted-row cleanup must not
        // trap a user in NIS Hub. Unreadable overflow rows expire independently.
        try { await clearSmsSession(supabase); } catch { /* No credential logging. */ }
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error)
            return { error: t.logoutError };
    }
    revalidatePath("/", "layout");
    redirect("/");
}
