import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PageIntro, Notice } from "@/components/ui";
import { AuthForm } from "@/components/auth-form";
import { getViewer } from "@/lib/auth";
import { safeNext } from "@/lib/validation";
export default async function LoginPage({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { t } = await getI18n();
    const viewer = await getViewer();
    const params = await searchParams;
    const next = safeNext(params.next);
    if (viewer.user)
        redirect(next);
    return <SiteShell><PageIntro kicker={t.account} title={t.login}>{t.loginHint}</PageIntro>{!viewer.configured && <div className="mt-6"><Notice>{t.authNotConfigured + " "}<Link className="underline" href="/setup">{t.setup}</Link></Notice></div>}{params.confirmation === "failed" && <p className="form-error mt-6" role="alert">{t.confirmFailed}</p>}<AuthForm mode="login" next={next} configured={viewer.configured}/><p className="mt-5 text-sm">{t.noAccount + " "}<Link className="underline" href="/signup">{t.signup}</Link></p></SiteShell>;
}
