"use client";
import { useState, useTransition } from "react";
import { useI18n } from "./locale-provider";
import { ThemeControl } from "./theme-control";
export function PreferenceControls({ localeAction }: { localeAction: (value: string) => Promise<{ ok: boolean }> }) {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return <div className="flex flex-wrap items-center gap-4"><ThemeControl labels={{theme:t.theme,light:t.light,dark:t.dark}} /><label className="flex items-center gap-2 text-sm"><span className="sr-only">{t.locale}</span><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg><select className="field !w-auto !py-2" value={locale} disabled={pending} onChange={event => { const value = event.target.value; startTransition(async () => { try { setFailed(!(await localeAction(value)).ok); } catch { setFailed(true); } }); }}><option value="ru" lang="ru">Русский</option><option value="kk" lang="kk">Қазақша</option><option value="en" lang="en">English</option></select></label>{failed && <p role="alert" className="text-sm text-[var(--danger)]">{t.localeError}</p>}</div>;
}
