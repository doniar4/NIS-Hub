import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { PreferenceControls } from "@/components/preference-controls";
import { changeLocale } from "@/app/actions/preferences";
import { Suspense, type ReactNode } from "react";
import { getViewer } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { logout } from "@/app/actions/auth";
async function AccountNav() {
    const { t } = await getI18n();
    const viewer = await getViewer();
    if (!viewer.user)
        return <Link className="button button-small" href="/login">{t.login}</Link>;
    return <div className="flex items-center gap-3">{viewer.profile?.role === "admin" && <Link className="text-sm underline" href="/admin">{t.admin}</Link>}<ActionForm action={logout} label={t.logout} className="text-sm"/></div>;
}
export async function SiteShell({ children }: {
    children: ReactNode;
}) {
    const { t } = await getI18n();
    return <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
    <a className="skip-link" href="#main">{t.skip}</a>
    <header className="border-b border-[var(--line)]">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link className="text-base font-semibold tracking-[-0.02em]" href="/">NIS Hub</Link>
        <PreferenceControls localeAction={changeLocale} /><Suspense fallback={<span className="text-sm">{t.checking}</span>}><AccountNav /></Suspense>
      </div>
      <nav aria-label={t.mainNav} className="mx-auto flex max-w-6xl flex-wrap gap-x-5 px-5 text-sm sm:px-8">
        {[['/', t.home], ['/library', t.library], ['/schedule', t.schedule], ['/profile', t.profile]].map(([href, label]) => <Link className="nav-link inline-flex min-h-11 items-center" href={href} key={href}>{label}</Link>)}
      </nav>
    </header>
    <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">{children}</main>
    <footer className="mx-auto mt-8 max-w-6xl border-t border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)] sm:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row"><p>NIS Hub · {t.beta}</p><div className="flex flex-wrap gap-5"><Link href="/privacy">{t.privacy}</Link><Link href="/terms">{t.terms}</Link></div></div>
    </footer>
  </div>;
}
