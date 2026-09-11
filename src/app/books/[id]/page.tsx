import { subjectName } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { getBook, getCatalogOptions } from "@/lib/queries";
export default async function BookPage({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { t, locale } = await getI18n();
    const { id } = await params;
    const book = await getBook(id);
    if (!book)
        notFound();
    const { classes, subjects } = await getCatalogOptions();
    const rows = [
        [t.subject, subjectName(subjects.find(s => s.id === book.subject_id), locale)],
        [t.class, classes.find(c => c.id === book.class_id)?.name],
        [t.author, book.author], [t.publisher, book.publisher],
        [t.year, book.publication_year], [t.bookLanguage, book.language], [t.pages, book.page_count],
    ].filter(([, value]) => value != null);
    return <SiteShell><Link className="text-sm underline" href="/library">{t.backLibrary}</Link><div className="mt-8"><PageIntro kicker={t.material} title={book.title}>{t.pdfHint}</PageIntro></div><dl className="my-8 grid max-w-3xl gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">{rows.map(([term, value]) => <div className="bg-[var(--surface)] p-5" key={term}><dt className="text-sm text-[var(--muted)]">{term}</dt><dd className="mt-1">{value}</dd></div>)}</dl><Link className="button" href={`/books/${id}/read`}>{t.readPdf}</Link></SiteShell>;
}
