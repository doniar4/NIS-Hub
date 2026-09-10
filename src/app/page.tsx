import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { EmptyState, PageIntro, SectionLink } from "@/components/ui";
import { ReadingList } from "@/components/reading-list";
import { getViewer } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/queries";
import { databaseSchedule } from "@/lib/schedule";
import { schoolDate } from "@/lib/validation";

export default async function Home() {
  const viewer = await getViewer();
  if (!viewer.user) return <SiteShell><PageIntro kicker="Учебное пространство" title="NIS Hub">Библиотека материалов, расписание вашего класса и сохранённые страницы.</PageIntro><div className="mt-8 flex flex-wrap gap-3"><Link className="button" href="/login">Войти</Link><Link className="button button-secondary" href="/signup">Создать аккаунт</Link></div><div className="mt-12"><EmptyState title={viewer.configured ? "Ваши материалы после входа" : "Подготовка к тестированию"}>{viewer.configured ? "Укажите класс в профиле, чтобы быстро открыть его расписание и учебные материалы." : "Подключение к аккаунтам и библиотеке ещё не настроено."}{!viewer.configured && <div className="mt-4"><SectionLink href="/setup">Настройка проекта</SectionLink></div>}</EmptyState></div></SiteShell>;
  const { classes, subjects } = await getCatalogOptions();
  const classId = viewer.profile?.class_id;
  const date = schoolDate();
  const lessons = classId ? await databaseSchedule.getDay(classId, date) : [];
  return <SiteShell><PageIntro kicker={classes.find(item => item.id === classId)?.name ?? "Ваше пространство"} title={viewer.profile?.display_name ? "Здравствуйте, " + viewer.profile.display_name : "Ваш учебный день"}>{date}</PageIntro><div className="mt-10 grid gap-10 lg:grid-cols-2"><section className="border-t-2 border-[var(--ink)] pt-5"><h2 className="section-title">Сегодня</h2>{lessons.length ? <ol className="mt-4 divide-y divide-[var(--line)]">{lessons.map(lesson => <li className="flex items-center gap-4 py-4" key={lesson.id}><span className="text-[var(--muted)]">{lesson.lesson_number}</span><span className="flex-1">{subjects.find(item => item.id === lesson.subject_id)?.name}</span>{lesson.room && <span>{lesson.room}</span>}</li>)}</ol> : <p className="py-6 text-[var(--muted)]">{classId ? "На сегодня занятий пока нет." : "Выберите класс в профиле."}</p>}<SectionLink href="/schedule">Всё расписание</SectionLink></section><section className="border-t-2 border-[var(--ink)] pt-5"><h2 className="section-title">Продолжить чтение</h2><ReadingList /><SectionLink href="/library">Открыть библиотеку</SectionLink></section></div></SiteShell>;
}
