import { SiteShell } from "@/components/site-shell";
import { PageIntro, EmptyState, Notice } from "@/components/ui";
import { Field, SelectField } from "@/components/fields";
import { requireViewer } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/queries";
import { databaseSchedule } from "@/lib/schedule";
import { dateSchema, schoolDate, uuid } from "@/lib/validation";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { profile } = await requireViewer("/schedule");
  const params = await searchParams;
  const classId = typeof params.classId === "string" ? params.classId : profile.class_id ?? "";
  const parsedDate = dateSchema.safeParse(params.date ?? schoolDate());
  const date = parsedDate.success ? parsedDate.data : schoolDate();
  const { classes, subjects } = await getCatalogOptions();
  const lessons = uuid.safeParse(classId).success ? await databaseSchedule.getDay(classId, date) : [];
  return <SiteShell><PageIntro kicker="Учебный день" title="Расписание">Занятия, добавленные администратором для вашего класса.</PageIntro><form action="/schedule" className="mt-8 grid max-w-2xl items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"><SelectField label="Класс" name="classId" options={classes} value={classId} required /><Field label="Дата" name="date" type="date" defaultValue={date} required /><button className="button" type="submit">Показать</button></form>{!parsedDate.success && <div className="mt-4"><Notice>Дата в ссылке некорректна. Показана сегодняшняя дата.</Notice></div>}<div className="mt-8">{lessons.length ? <ol className="divide-y divide-[var(--line)] border-y border-[var(--line)]">{lessons.map(lesson => <li className="flex items-start gap-5 py-5" key={lesson.id}><span className="w-6 font-semibold text-[var(--muted)]">{lesson.lesson_number}</span><div className="flex-1"><h2 className="font-semibold">{subjects.find(s => s.id === lesson.subject_id)?.name}</h2>{lesson.teacher && <p className="mt-1 text-sm text-[var(--muted)]">{lesson.teacher}</p>}</div>{lesson.room && <p className="text-sm">Кабинет {lesson.room}</p>}</li>)}</ol> : <EmptyState title={classId ? "Занятий пока нет" : "Выберите класс"}>{classId ? "На выбранную дату расписание ещё не добавлено." : "После выбора класса здесь появится его расписание."}</EmptyState>}</div></SiteShell>;
}
