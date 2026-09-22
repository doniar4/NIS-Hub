import {EduPageSync} from "@/components/edupage-sync";
import {getEduPageStatus} from "@/lib/edupage/state";
import {adminCopy} from "@/lib/admin-copy";
import { AdminOverview } from "@/components/admin-overview";
import { subjectMap } from "@/lib/catalog";
import { v05Copy } from "@/lib/v05-copy";
import { getNonSchoolDays } from "@/lib/calendar-queries";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/fields";
import { BookEditor } from "@/components/book-editor";
import { WeeklyImport } from "@/components/weekly-import";
import { WeeklyScheduleBrowser } from "@/components/weekly-schedule";
import { saveBook } from "@/app/actions/books";
import { importWeeklySchedule } from "@/app/actions/weekly-import";
import { requireAdmin } from "@/lib/auth";
import { database, getCatalogOptions } from "@/lib/queries";
import { getWeeklySchedule } from "@/lib/weekly-queries";
import { adminEntitySchema, schoolDate, uuid } from "@/lib/validation";
import { saveAdminRecord, deleteAdminRecord } from "@/app/actions/admin";
import { getI18n } from "@/lib/i18n-server";
import { phase4Copy } from "@/lib/phase4-copy";
import { lessonRange } from "@/lib/weekly-schedule";
import { subjectName } from "@/lib/i18n";
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ entity?: string; id?: string }> }) {
  await requireAdmin();
  const params = await searchParams, { locale } = await getI18n(), p = phase4Copy(locale);
  if (!params.entity) return <AdminOverview/>;
  const v=v05Copy(locale),a=adminCopy(locale);
  const tabs=[["books",v.books],["classes",a.classes],["subjects",a.subjects],["schedule",v.schedule]] as const;
  const entity = adminEntitySchema.safeParse(params.entity ?? "books");
  if (!entity.success || (params.id && !uuid.safeParse(params.id).success)) notFound();
  const section = entity.data, db = await database();
  const { classes, subjects } = await getCatalogOptions();
  const subjectsById=subjectMap(subjects);
  const nonSchoolDays=section==="schedule"?await getNonSchoolDays():[];
  const booksResult = section === "books" ? await db.from("books").select("*").order("title").limit(200) : { data: [], error: null };
  if (booksResult.error) throw new Error(p.bookError);
  const books = booksResult.data;
  // Explicitly retrieve a requested record even outside the 200-item admin list.
  const selectedBook = section === "books" && params.id ? await db.from("books").select("*").eq("id",params.id).maybeSingle() : { data: null, error: null };
  if (selectedBook.error) throw new Error(p.bookError);
  const book = selectedBook.data ?? undefined;
  const variantResult=book?await db.from("book_variants").select("*").eq("book_id",book.id).order("created_at"):{data:[],error:null};
  if(variantResult.error)throw new Error(p.bookError);
  const lessons = section === "schedule" ? await getWeeklySchedule() : [];
  const edupage = section === "schedule" ? await getEduPageStatus() : null;
  const classRow = section === "classes" ? classes.find(c => c.id === params.id) : undefined;
  const subject = section === "subjects" ? subjects.find(s => s.id === params.id) : undefined;
  const lesson = section === "schedule" ? lessons.find(l => l.id === params.id) : undefined;
  const selected = book ?? classRow ?? subject ?? lesson;
  if (params.id && !selected) notFound();
  const rows = section === "books" ? books.map(b => ({ id: b.id, name: b.title, detail: p[b.publication_status] }))
    : section === "classes" ? classes.map(c => ({ id: c.id, name: c.name, detail: "" }))
    : section === "subjects" ? subjects.map(s => ({ id: s.id, name: subjectName(s,locale), detail: "" }))
    : lessons.map(l => ({ id: l.id, name: classes.find(c => c.id === l.class_id)?.name+" · "+p.shortDays[l.weekday-1]+" · "+lessonRange(l), detail: subjectName(subjectsById.get(l.subject_id),locale)+(l.subgroup_label?" · "+l.subgroup_label:"")+" · "+(l.effective_from||"…")+" — "+(l.effective_to||"…") }));
  return <SiteShell><PageIntro kicker={v.adminReply} title={v.dashboard}>{v.dashboardHint}</PageIntro>
    <Link className="text-link" href="/admin">{v.dashboard}</Link><nav className="my-8 flex flex-wrap gap-3" aria-label={v.dashboard}>{tabs.map(([key,label]) => <Link key={key} aria-current={section===key ? "page" : undefined} className={"button "+(section===key ? "" : "button-secondary")} href={"/admin?entity="+key}>{label}</Link>)}</nav>
    {section==="schedule" && <>{edupage && <EduPageSync initial={edupage} classes={classes} subjects={subjects}/>}<WeeklyScheduleBrowser lessons={lessons} classes={classes} subjects={subjects} initialClassId={lesson?.class_id ?? classes[0]?.id ?? ""} date={schoolDate()} nonSchoolDays={nonSchoolDays}/><div id="import"/><WeeklyImport classes={classes} subjects={subjects} lessons={lessons} action={importWeeklySchedule}/></>}
    <div className="admin-workspace mt-10">
      <section className="surface-card admin-records"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-title">{a.records}</h2><Link className="text-sm underline" href={"/admin?entity="+section}>{a.create}</Link></div>
        {section==="books" && <p className="my-4 text-sm text-[var(--muted)]">{a.limit}</p>}
        <ul className="max-h-[40rem] overflow-auto divide-y divide-[var(--line)]">{rows.map(row => <li className="py-4" key={row.id}><Link aria-current={params.id===row.id?"page":undefined} className="block break-words font-semibold underline underline-offset-4" href={"/admin?entity="+section+"&id="+row.id}>{row.name}</Link>{row.detail && <p className="mt-1 text-sm text-[var(--muted)]">{row.detail}</p>}</li>)}</ul>{!rows.length && <p>{v.empty}</p>}
      </section>
      <section className="surface-card admin-editor" key={section+"-"+(params.id ?? "new")}><h2 className="section-title mb-6">{selected ? a.edit : a.new}</h2>
        {section==="books" && <BookEditor id={book?.id ?? randomUUID()} book={book} variants={variantResult.data} classes={classes} subjects={subjects} action={saveBook}/>}
        {(section==="classes" || section==="subjects") && <ActionForm action={saveAdminRecord} label={a.save}>
          <input type="hidden" name="entity" value={section}/><input type="hidden" name="id" value={params.id ?? ""}/>
          {section==="classes" ? <><Field label={a.className} name="name" required maxLength={40} defaultValue={classRow?.name ?? ""}/><Field label={a.grade} name="grade" type="number" min={1} max={12} defaultValue={classRow?.grade ?? ""}/><Field label={a.section} name="section" maxLength={10} defaultValue={classRow?.section ?? ""}/></>
            : <><Field label={a.subjectName} name="name" required maxLength={100} defaultValue={subject?.name ?? ""}/><Field label="Русский" name="name_ru" required maxLength={100} defaultValue={subject?.name_ru??subject?.name??""}/><Field label={a.kazakh} name="name_kz" required maxLength={100} defaultValue={subject?.name_kz ?? ""}/><Field label={a.english} name="name_en" required maxLength={100} defaultValue={subject?.name_en ?? ""}/><Field label={a.short} name="short_name" maxLength={30} defaultValue={subject?.short_name ?? ""}/></>}
        </ActionForm>}
        {section==="schedule" && <p>{p.csvHint}</p>}
        {selected && <div className="mt-10 border-t border-[var(--line)] pt-6"><ActionForm action={deleteAdminRecord} label={section==="books" ? a.archive : v.remove}>
          <input type="hidden" name="entity" value={section}/><input type="hidden" name="id" value={selected.id}/>
          <p className="text-sm text-[var(--muted)]">{section==="books" ? a.archiveHint : section==="schedule" ? a.lessonDelete : a.deleteHint}</p>
          <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="confirm_delete" required/>{v.confirm}</label>
        </ActionForm></div>}
      </section>
    </div>
  </SiteShell>;
}
