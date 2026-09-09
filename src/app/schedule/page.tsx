import { CalendarIcon } from "@/components/icons";
import { ClassPicker } from "@/components/local-demo";
import { SiteShell } from "@/components/site-shell";
import { Notice, PageIntro } from "@/components/ui";
import { testSchedule } from "@/lib/data";

export default function SchedulePage() {
  return <SiteShell><PageIntro kicker="Schedule" title="Расписание">В v0.1 расписание хранится локально или в базе данных. Интеграция с EduPage не реализована.</PageIntro><div className="mt-8 max-w-xs"><ClassPicker /></div><div className="mt-8"><Notice>Показанные предметы — тестовые данные для разработки, а не фактическое расписание класса.</Notice></div><section className="mt-10 max-w-3xl border-t-2 border-[var(--ink)] pt-5"><div className="flex items-center gap-3"><CalendarIcon size={21} /><h2 className="text-xl font-semibold tracking-[-0.02em]">Демонстрационный день</h2></div><ol className="mt-6 divide-y divide-[var(--line)]">{testSchedule.map((lesson) => <li className="grid grid-cols-[3rem_minmax(0,1fr)_4rem] gap-4 py-4" key={lesson.order}><span className="font-semibold text-[var(--muted)]">{String(lesson.order).padStart(2, "0")}</span><span className="font-medium">{lesson.subject}</span><span className="text-right text-sm text-[var(--muted)]">{lesson.room}</span></li>)}</ol></section><p className="mt-7 max-w-2xl text-sm leading-6 text-[var(--muted)]">Перед импортом реального расписания нужно подтвердить источник, метод доступа, стабильность и разрешение на использование данных.</p></SiteShell>;
}
