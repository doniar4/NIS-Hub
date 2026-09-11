import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { PageIntro, EmptyState } from "@/components/ui";
import { Field, SelectField } from "@/components/fields";
import { getBooks, getCatalogOptions } from "@/lib/queries";
import { requireViewer } from "@/lib/auth";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { profile } = await requireViewer("/library");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0,100) : "";
  const subject = typeof params.subject === "string" ? params.subject : "";
  const classId = typeof params.classId === "string" ? params.classId : profile.class_id ?? "";
  const [{ classes, subjects }, books] = await Promise.all([getCatalogOptions(), getBooks({ q, subject, classId })]);
  return <SiteShell><PageIntro kicker="Материалы" title="Библиотека">Выберите класс и предмет или найдите книгу по названию.</PageIntro><form action="/library" className="mt-8 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]"><Field label="Название" name="q" defaultValue={q} maxLength={100} type="search" /><SelectField label="Класс" name="classId" options={classes} value={classId} empty="Все классы" /><SelectField label="Предмет" name="subject" options={subjects} value={subject} empty="Все предметы" /><button className="button justify-center" type="submit">Найти</button></form><div className="mt-8">{!books.length ? <EmptyState title="Материалы не найдены">Измените фильтры или загляните позже. Здесь появятся опубликованные материалы с подтверждённым правом на размещение.</EmptyState> : <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{books.map(book => <li key={book.id} className="border border-[var(--line)] bg-[var(--surface)] p-6"><p className="field-label">{subjects.find(s => s.id === book.subject_id)?.name}</p><h2 className="text-xl font-semibold"><Link className="underline-offset-4 hover:underline" href={"/books/" + book.id}>{book.title}</Link></h2><p className="mt-3 text-sm text-[var(--muted)]">{[classes.find(c => c.id === book.class_id)?.name, book.language].filter(Boolean).join(" · ")}</p><Link className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold underline" href={"/books/" + book.id}>Открыть материал</Link></li>)}</ul>}</div>{books.length === 100 && <p className="mt-4 text-sm">Показаны первые 100 результатов. Уточните поиск.</p>}</SiteShell>;
}
