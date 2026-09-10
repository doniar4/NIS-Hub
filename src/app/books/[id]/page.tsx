import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { getBook, getCatalogOptions } from "@/lib/queries";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();
  const { classes, subjects } = await getCatalogOptions();
  const rows = [
    ["Предмет", subjects.find(s => s.id === book.subject_id)?.name],
    ["Класс", classes.find(c => c.id === book.class_id)?.name],
    ["Автор", book.author], ["Издатель", book.publisher],
    ["Год издания", book.publication_year], ["Язык", book.language], ["Страниц", book.page_count],
  ].filter(([, value]) => value != null);
  return <SiteShell><Link className="text-sm underline" href="/library">← Библиотека</Link><div className="mt-8"><PageIntro kicker="Учебный материал" title={book.title}>PDF для чтения в личном кабинете.</PageIntro></div><dl className="my-8 grid max-w-3xl gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">{rows.map(([term, value]) => <div className="bg-white p-5" key={term}><dt className="text-sm text-[var(--muted)]">{term}</dt><dd className="mt-1">{value}</dd></div>)}</dl><Link className="button" href={`/books/${id}/read`}>Читать PDF</Link></SiteShell>;
}
