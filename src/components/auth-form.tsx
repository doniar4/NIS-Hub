import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { authenticate } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/fields";
export async function AuthForm({ mode, next, configured }: {
    mode: "login" | "signup";
    next: string;
    configured: boolean;
}) {
    const { t } = await getI18n();
    const signup = mode === "signup";
    return <ActionForm action={authenticate.bind(null, mode)} disabled={!configured} label={signup ? t.signup : t.login} className="mt-8 max-w-md space-y-5 border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
    <input name="next" type="hidden" value={next}/>
    <Field label={t.email} name="email" type="email" autoComplete="email" required maxLength={254}/>
    <Field label={t.password} name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={8} maxLength={128}/>
    <p className="text-sm text-[var(--muted)]">{t.passwordHint}</p>
    {signup && <label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1 h-5 w-5 shrink-0" type="checkbox" name="terms" required/><span>{t.accept + " "}<Link className="underline" href="/terms">{t.consentTerms}</Link>{" "}{t.andPrivacy + " "}<Link className="underline" href="/privacy">{t.consentPrivacy}</Link>.</span></label>}
  </ActionForm>;
}
