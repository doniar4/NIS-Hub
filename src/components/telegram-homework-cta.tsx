import type { Locale } from "@/lib/i18n";
import { v053Copy } from "@/lib/v053-copy";

const botUrl = "https://t.me/nis_hub_support_bot";

export function TelegramHomeworkLink({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const p = v053Copy(locale);
  return (
    <a
      href={botUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={compact
        ? "text-link text-sm gap-2"
        : "button w-full sm:w-auto"}
    >
      {compact && <span aria-hidden="true">➕</span>}
      {compact ? p.telegramHomeworkShort : p.telegramHomeworkOpen}
    </a>
  );
}

export function TelegramHomeworkCta({ locale }: { locale: Locale }) {
  const p = v053Copy(locale);
  return (
    <aside className="min-w-0 rounded-2xl border border-[var(--line)] p-4 space-y-3">
      <h3 className="text-base font-semibold flex items-start gap-2">
        <span aria-hidden="true">📚</span>
        {p.telegramHomeworkTitle}
      </h3>
      <p className="text-sm leading-relaxed text-[var(--muted)] break-words">
        {p.telegramHomeworkHint}
      </p>
      <TelegramHomeworkLink locale={locale} />
    </aside>
  );
}
