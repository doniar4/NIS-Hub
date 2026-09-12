import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PageIntro, Notice } from "@/components/ui";
import { AuthForm } from "@/components/auth-form";
import { getViewer } from "@/lib/auth";
export default async function SignupPage() {
    const { t } = await getI18n();
    const viewer = await getViewer();
    if (viewer.user)
        redirect("/profile");
    return <SiteShell><PageIntro kicker={t.account} title={t.signup}>{t.signupHint}</PageIntro>{!viewer.configured && <div className="mt-6"><Notice>{t.authNotConfigured}</Notice></div>}<AuthForm mode="signup" next="/profile" configured={viewer.configured}/><p className="mt-5 text-sm">{t.hasAccount + " "}<Link className="underline" href="/login">{t.login}</Link></p></SiteShell>;
}
