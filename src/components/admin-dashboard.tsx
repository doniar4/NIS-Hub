import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { adminCopy } from "@/lib/admin-copy";
import { v05Copy } from "@/lib/v05-copy";
import { PageIntro } from "./ui";
import type { AdminActivityStats } from "@/app/actions/activity";

export function AdminDashboard({
  locale,
  open,
  unread,
  recent,
  activity,
}: {
  locale: Locale;
  open: number;
  unread: number;
  recent: { id: string; created_at: string; source_type: string; row_count: number }[];
  activity?: AdminActivityStats | null;
}) {
  const t = v05Copy(locale);
  return (
    <>
      <PageIntro kicker="Admin" title={t.dashboard}>
        {t.dashboardHint}
      </PageIntro>
      <p className="my-5">
        <Link className="text-link" href="/admin/tickets">
          {t.openCount}: {open} · {t.unread}: {unread}
        </Link>
      </p>

      {/* Real User Tracker Widget */}
      <section className="surface-card mb-8 p-6">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="section-title text-xl">
              {locale === "kk" ? "Нақты уақыттағы белсенділік" : locale === "en" ? "Real-time User Activity" : "Активность пользователей онлайн"}
            </h2>
          </div>
          {activity && (
            <span className="text-xs text-[var(--muted)]">
              {activity.onlineCount} {locale === "kk" ? "онлайн (15 мин)" : locale === "en" ? "online (15m)" : "онлайн сейчас"}
            </span>
          )}
        </div>

        {activity ? (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4">
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)]">
                <span className="text-xs uppercase tracking-wider text-[var(--muted)] font-medium">
                  {locale === "kk" ? "Онлайн (соңғы 15 мин)" : locale === "en" ? "Active (last 15m)" : "Онлайн (последние 15 мин)"}
                </span>
                <p className="text-2xl font-bold mt-1 text-emerald-500">{activity.onlineCount}</p>
              </div>
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)]">
                <span className="text-xs uppercase tracking-wider text-[var(--muted)] font-medium">
                  {locale === "kk" ? "Бүгінгі бірегей оқушылар" : locale === "en" ? "Unique today" : "Уникальных сегодня"}
                </span>
                <p className="text-2xl font-bold mt-1 text-[var(--accent)]">{activity.todayCount}</p>
              </div>
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)]">
                <span className="text-xs uppercase tracking-wider text-[var(--muted)] font-medium">
                  {locale === "kk" ? "Бүгінгі қаралымдар" : locale === "en" ? "Pageviews today" : "Просмотров сегодня"}
                </span>
                <p className="text-2xl font-bold mt-1 text-[var(--ink)]">{activity.totalHitsToday}</p>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                {locale === "kk" ? "Соңғы әрекеттер" : locale === "en" ? "Recent Activity" : "Последняя активность"}
              </h3>
              {activity.recent.length === 0 ? (
                <p className="text-xs text-[var(--muted)] py-2">
                  {locale === "kk" ? "Әзірге әрекеттер жоқ." : locale === "en" ? "No activity logged yet." : "Пока нет записей активности."}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--line)] max-h-64 overflow-y-auto">
                  {activity.recent.map((item) => (
                    <li key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <strong className="text-[var(--ink)] truncate max-w-[140px]">
                          {item.user_name || "Ученик"}
                        </strong>
                        <span className="text-[var(--muted)]">→</span>
                        <code className="text-xs bg-[var(--hover)] px-1.5 py-0.5 rounded text-[var(--accent)] font-mono">
                          {item.path}
                        </code>
                      </div>
                      <time className="text-[var(--muted)] whitespace-nowrap ml-2">
                        {new Intl.DateTimeFormat(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        }).format(new Date(item.created_at))}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--muted)] py-4">
            {locale === "kk" 
              ? "Белсенділік трекерін қосу үшін Supabase SQL редакторында соңғы миграцияны іске қосыңыз." 
              : locale === "en" 
                ? "To enable live activity tracking, apply the latest migration in Supabase SQL editor." 
                : "Чтобы включить трекер активности, примените миграцию в Supabase SQL редакторе."}
          </p>
        )}
      </section>

      <nav aria-label={t.dashboard} className="my-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          [t.books, "/admin?entity=books"],
          [t.schedule, "/admin?entity=schedule"],
          [t.imports, "/admin?entity=schedule#import"],
          [t.versions, "/admin/versions"],
          [t.calendar, "/admin/calendar"],
          [adminCopy(locale).classes, "/admin?entity=classes"],
          [adminCopy(locale).subjects, "/admin?entity=subjects"],
          [t.support, "/admin/tickets"],
        ].map(([label, href]) => (
          <Link key={href} className="dashboard-card" href={href}>
            {label}
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </nav>

      <section className="surface-card">
        <h2 className="section-title">{t.recent}</h2>
        <ul>
          {recent.map((row) => (
            <li className="py-3" key={row.id}>
              <Link className="text-link" href={"/admin/versions?id=" + row.id}>
                {row.created_at.slice(0, 16).replace("T", " ")} UTC · {row.source_type} · {row.row_count}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
