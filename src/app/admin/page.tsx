import { ScheduleImport } from "@/components/schedule-import";
import { importSchedule } from "@/app/actions/schedule-import";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { Notice, PageIntro } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/fields";
import { requireAdmin } from "@/lib/auth";
import { database, getCatalogOptions } from "@/lib/queries";
import { adminEntitySchema, schoolDate, uuid } from "@/lib/validation";
import { saveAdminRecord, deleteAdminRecord } from "@/app/actions/admin";

const tabs = [["books", "Материалы"], ["classes", "Классы"], ["subjects", "Предметы"], ["schedule", "Расписание"]] as const;
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ entity?: string; id?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const entity = adminEntitySchema.safeParse(params.entity ?? "books");
  if (!entity.success || (params.id && !uuid.safeParse(params.id).success)) notFound();
  const section = entity.data;
  const db = await database();
  const { classes, subjects } = await getCatalogOptions();
  const [booksResult, scheduleResult, rightsResult] = await Promise.all([
    db.from("books").select("*").order("title").limit(200),
    db.from("schedule").select("*").order("date", { ascending: false }).order("lesson_number").limit(200),
    db.from("book_rights").select("*").limit(200),
  ]);
  if (booksResult.error || scheduleResult.error || rightsResult.error) throw new Error("Не удалось загрузить управление.");
  const books = booksResult.data, lessons = scheduleResult.data;
  const book = section === "books" ? books.find(b => b.id === params.id) : undefined;
  const classRow = section === "classes" ? classes.find(c => c.id === params.id) : undefined;
  const subject = section === "subjects" ? subjects.find(s => s.id === params.id) : undefined;
  const lesson = section === "schedule" ? lessons.find(l => l.id === params.id) : undefined;
  const rights = rightsResult.data.find(r => r.book_id === book?.id);
  const selected = book ?? classRow ?? subject ?? lesson;
  if (params.id && !selected) notFound();
  const rows = section === "books" ? books.map(b => ({ id: b.id, name: b.title, detail: b.publication_status }))
    : section === "classes" ? classes.map(c => ({ id: c.id, name: c.name, detail: "" }))
    : section === "subjects" ? subjects.map(s => ({ id: s.id, name: s.name, detail: "" }))
    : lessons.map(l => ({ id: l.id, name: `${l.date} · ${classes.find(c => c.id === l.class_id)?.name ?? "Класс"} · урок ${l.lesson_number}`, detail: subjects.find(s => s.id === l.subject_id)?.name ?? "" }));
  return <SiteShell><PageIntro kicker="Администратор" title="Управление">Изменения сохраняются в базе. Содержимое раздела доступно только администратору.</PageIntro>
    <nav className="my-8 flex flex-wrap gap-3" aria-label="Разделы управления">{tabs.map(([key, label]) => <Link key={key} aria-current={section === key ? "page" : undefined} className={`button ${section === key ? "" : "button-secondary"}`} href={`/admin?entity=${key}`}>{label}</Link>)}</nav>
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <section><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-title">Записи</h2><Link className="text-sm underline" href={`/admin?entity=${section}`}>Создать запись</Link></div><p className="my-4 text-sm text-[var(--muted)]">Показано до 200 записей. Расписание — начиная с последних дат.</p><ul className="divide-y divide-[var(--line)]">{rows.map(row => <li className="py-4" key={row.id}><Link className="block break-words font-semibold underline underline-offset-4" href={`/admin?entity=${section}&id=${row.id}`}>{row.name}</Link>{row.detail && <p className="mt-1 text-sm text-[var(--muted)]">{row.detail}</p>}</li>)}</ul>{rows.length === 0 && <p>Записей пока нет.</p>}</section>
      <section key={`${section}-${params.id ?? "new"}`}><h2 className="section-title mb-6">{selected ? "Редактировать запись" : "Новая запись"}</h2>
        <ActionForm action={saveAdminRecord} label="Сохранить">
          <input type="hidden" name="entity" value={section} /><input type="hidden" name="id" value={params.id ?? ""} />
          {section === "books" && <>
            <Notice>Сначала загрузите разрешённый PDF в приватный bucket <code>book-files</code> через Supabase Dashboard. Здесь укажите его путь, например <code>books/my-notes.pdf</code>. Замена файла по тому же пути требует повторной проверки прав.</Notice>
            <Field label="Название" name="title" required maxLength={200} defaultValue={book?.title ?? ""} />
            <SelectField label="Предмет" name="subject_id" options={subjects} required defaultValue={book?.subject_id ?? ""} />
            <SelectField label="Класс (необязательно)" name="class_id" options={classes} defaultValue={book?.class_id ?? ""} />
            <div className="grid gap-5 sm:grid-cols-2"><Field label="Автор" name="author" maxLength={200} defaultValue={book?.author ?? ""} /><Field label="Издатель" name="publisher" maxLength={200} defaultValue={book?.publisher ?? ""} /><Field label="Год издания" name="publication_year" type="number" min={1000} max={9999} defaultValue={book?.publication_year ?? ""} /><Field label="Язык" name="language" maxLength={40} defaultValue={book?.language ?? ""} /></div>
            <Field label="Путь к PDF в book-files" name="file_path" required maxLength={500} defaultValue={book?.file_path ?? ""} />
            <Field label="Число страниц (если известно)" name="page_count" type="number" min={1} max={100000} defaultValue={book?.page_count ?? ""} />
            <label><span className="field-label">Права на размещение</span><select className="field" name="license_status" defaultValue={book?.license_status ?? "pending_review"}><option value="pending_review">Не проверены</option><option value="approved">Подтверждены</option><option value="restricted">Размещение запрещено</option></select></label>
            <label><span className="field-label">Публикация</span><select className="field" name="publication_status" defaultValue={book?.publication_status ?? "draft"}><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="archived">Архив</option></select></label>
            <Field label="Источник материала (ссылка или описание)" name="source" required maxLength={500} defaultValue={rights?.source ?? ""} />
            <label><span className="field-label">Основание для размещения (видно только администратору)</span><textarea className="field" name="permission_note" required maxLength={2000} rows={4} defaultValue={rights?.permission_note ?? ""} /></label>
            <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="confirm_rights" />Я проверил права на размещение этого файла. Обязательно при публикации.</label>
          </>}
          {section === "classes" && <><Field label="Название класса" name="name" required maxLength={40} defaultValue={classRow?.name ?? ""} /><Field label="Параллель (1–12)" name="grade" type="number" min={1} max={12} defaultValue={classRow?.grade ?? ""} /><Field label="Буква / секция" name="section" maxLength={10} defaultValue={classRow?.section ?? ""} /></>}
          {section === "subjects" && <><Field label="Название предмета" name="name" required maxLength={100} defaultValue={subject?.name ?? ""} /><Field label="Название на казахском" name="name_kz" maxLength={100} defaultValue={subject?.name_kz ?? ""} /><Field label="Название на английском" name="name_en" maxLength={100} defaultValue={subject?.name_en ?? ""} /><Field label="Краткое название" name="short_name" maxLength={30} defaultValue={subject?.short_name ?? ""} /></>}
          {section === "schedule" && <><SelectField label="Класс" name="class_id" options={classes} required defaultValue={lesson?.class_id ?? ""} /><Field label="Дата" name="date" type="date" required defaultValue={lesson?.date ?? schoolDate()} /><Field label="Номер урока" name="lesson_number" type="number" required min={1} max={20} defaultValue={lesson?.lesson_number ?? 1} /><SelectField label="Предмет" name="subject_id" options={subjects} required defaultValue={lesson?.subject_id ?? ""} /><Field label="Учитель (необязательно)" name="teacher" maxLength={100} defaultValue={lesson?.teacher ?? ""} /><Field label="Кабинет (необязательно)" name="room" maxLength={40} defaultValue={lesson?.room ?? ""} /></>}
        </ActionForm>
        {selected && <div className="mt-10 border-t border-[var(--line)] pt-6"><ActionForm action={deleteAdminRecord} label={section === "books" ? "Переместить в архив" : "Удалить запись"}><input type="hidden" name="entity" value={section} /><input type="hidden" name="id" value={selected.id} /><p className="text-sm text-[var(--muted)]">{section === "books" ? "Книга исчезнет из библиотеки. Файл и закладки сохранятся; публикацию можно восстановить." : "Действие необратимо. Используемые классы и предметы удалить нельзя."}</p><label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="confirm_delete" required />Подтверждаю действие с записью «{rows.find(r => r.id === selected.id)?.name}».</label></ActionForm></div>}
      </section>
    </div>
    {section === "schedule" && <ScheduleImport action={importSchedule} classes={classes} subjects={subjects}/>}
  </SiteShell>;
}
