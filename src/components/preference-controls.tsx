"use client";
import { useState, useTransition } from "react";
import { useI18n } from "./locale-provider";
import { ThemeControl } from "./theme-control";
export function PreferenceControls({ localeAction }: { localeAction: (value: string) => Promise<{ ok: boolean }> }) {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return <div className="flex flex-wrap items-center gap-4"><ThemeControl labels={{theme:t.theme,light:t.light,dark:t.dark,system:t.system}} /><label className="flex items-center gap-2 text-sm"><span>{t.locale}</span><select className="field !w-auto !py-2" value={locale} disabled={pending} onChange={event => { const value = event.target.value; startTransition(async () => { try { setFailed(!(await localeAction(value)).ok); } catch { setFailed(true); } }); }}><option value="ru" lang="ru">RU · Русский</option><option value="kk" lang="kk">KZ · Қазақша</option><option value="en" lang="en">EN · English</option></select></label>{failed && <p role="alert" className="text-sm text-[var(--danger)]">{t.localeError}</p>}</div>;
}
