import { controlCopy } from "@/lib/admin-control";
import type { Locale } from "@/lib/i18n";
export function AdminSkeleton({locale="ru",compact=false}:{locale?:Locale;compact?:boolean}) {
  return <div className={"admin-skeleton "+(compact?"":"surface-card")} role="status" aria-live="polite"><span className="sr-only">{controlCopy(locale).loading}</span><div/><div/><div/></div>;
}
