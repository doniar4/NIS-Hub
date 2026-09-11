import Link from "next/link";
import { ThemeControl } from "@/components/theme-control";
import { Suspense, type ReactNode } from "react";
import { getViewer } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { logout } from "@/app/actions/auth";

async function AccountNav() {
  const viewer = await getViewer();
  if (!viewer.user) return <Link className="button button-small" href="/login">Войти</Link>;
  return <div className="flex items-center gap-3">{viewer.profile?.role === "admin" && <Link className="text-sm underline" href="/admin">Управление</Link>}<ActionForm action={logout} label="Выйти" className="text-sm" /></div>;
}

export function SiteShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
    <a className="skip-link" href="#main">Перейти к содержимому</a>
    <header className="border-b border-[var(--line)]">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link className="text-base font-semibold tracking-[-0.02em]" href="/">NIS Hub</Link>
        <ThemeControl /><Suspense fallback={<span className="text-sm">Проверка входа…</span>}><AccountNav /></Suspense>
      </div>
      <nav aria-label="Основная навигация" className="mx-auto flex max-w-6xl flex-wrap gap-x-5 px-5 text-sm sm:px-8">
        {[['/', 'Главная'], ['/library', 'Библиотека'], ['/schedule', 'Расписание'], ['/profile', 'Профиль']].map(([href, label]) => <Link className="nav-link inline-flex min-h-11 items-center" href={href} key={href}>{label}</Link>)}
      </nav>
    </header>
    <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">{children}</main>
    <footer className="mx-auto mt-8 max-w-6xl border-t border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)] sm:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row"><p>NIS Hub · Версия для тестирования</p><div className="flex flex-wrap gap-5"><Link href="/privacy">Конфиденциальность</Link><Link href="/terms">Условия</Link></div></div>
    </footer>
  </div>;
}
