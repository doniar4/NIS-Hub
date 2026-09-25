import type { Locale } from "@/lib/i18n";

const copy: Record<Locale, { title: string; text: string }> = {
  ru: { title: "О проекте", text: "NIS Hub объединяет учебные материалы, расписание и инструменты для самостоятельной учёбы." },
  kk: { title: "Жоба туралы", text: "NIS Hub оқу материалдарын, кестені және өз бетінше оқуға арналған құралдарды біріктіреді." },
  en: { title: "About the project", text: "NIS Hub brings together learning materials, timetables, and tools for independent study." },
};

export function AboutProject({ locale }: { locale: Locale }) {
  const value = copy[locale];
  return <section className="surface-card mt-8 p-6"><h2 className="section-title">{value.title}</h2><p className="mt-3 text-[var(--muted)]">{value.text}</p></section>;
}
