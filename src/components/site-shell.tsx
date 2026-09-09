import Link from "next/link";
import type { ReactNode } from "react";
import { BookIcon, CalendarIcon, UserIcon } from "@/components/icons";

const navigation = [
  { href: "/library", label: "Библиотека", icon: BookIcon },
  { href: "/schedule", label: "Расписание", icon: CalendarIcon },
  { href: "/profile", label: "Профиль", icon: UserIcon },
];

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--canvas)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link className="text-base font-semibold tracking-[-0.02em]" href="/">
            NIS Library
          </Link>
          <nav aria-label="Основная навигация" className="hidden items-center gap-6 text-sm text-[var(--muted)] md:flex">
            {navigation.map(({ href, label }) => <Link className="nav-link" href={href} key={href}>{label}</Link>)}
          </nav>
          <Link className="button button-small" href="/login">Войти</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">{children}</main>
      <footer className="mx-auto mt-8 max-w-6xl border-t border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)] sm:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row">
          <p>Демонстрационный прототип. Не содержит опубликованных учебников.</p>
          <div className="flex gap-5"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/admin">Admin</Link></div>
        </div>
      </footer>
    </div>
  );
}
