import { AiStudyPanel } from "@/components/ai-study-panel";
import { aiStudyConfig } from "@/lib/ai-study-config";
import { EditionPicker } from "@/components/edition-picker";
import { selectEdition } from "@/lib/editions";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PdfReader } from "@/components/pdf-reader";
import { requireViewer } from "@/lib/auth";
import { database, getBook, getBookVariants, getCatalogOptions } from "@/lib/queries";
import { pageSchema } from "@/lib/validation";
import { subjectName } from "@/lib/i18n";
import { v051Copy } from "@/lib/v051-copy";

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    page?: string;
    variant?: string;
  }>;
}) {
  const { t, locale } = await getI18n();
  const p = v051Copy(locale);
  const { id } = await params;
  const { user } = await requireViewer(`/books/${id}/read`);
  const book = await getBook(id);
  if (!book) notFound();

  const [variants, { subjects }] = await Promise.all([
    getBookVariants(id),
    getCatalogOptions(),
  ]);
  const query = await searchParams;
  const edition = selectEdition(variants, id, query.variant);
  if (!edition) notFound();

  const supabase = await database();
  const [progress, bookmarks] = await Promise.all([
    supabase
      .from("variant_reading_progress")
      .select("page_number")
      .eq("profile_id", user.id)
      .eq("book_variant_id", edition.id)
      .maybeSingle(),
    supabase
      .from("variant_bookmarks")
      .select("page_number")
      .eq("profile_id", user.id)
      .eq("book_variant_id", edition.id)
      .order("page_number"),
  ]);

  if (progress.error || bookmarks.error)
    throw new Error("Не удалось загрузить настройки чтения.");

  const requested = pageSchema.safeParse(query.page);
  const ai = aiStudyConfig();
  const startPage = requested.success
    ? requested.data
    : progress.data?.page_number ?? 1;

  const infoRows = [
    [t.subject, subjectName(subjects.find((s) => s.id === book.subject_id), locale)],
    [p.grade, book.grade],
    [t.author, book.author],
    [t.publisher, book.publisher],
    [t.year, book.publication_year],
    [t.pages, edition.page_count],
  ].filter(([, v]) => v != null);

  return (
    <SiteShell>
      <div className="flex items-center justify-between gap-4 mb-4">
        <Link className="text-link inline-flex items-center text-sm" href="/library">
          ← {t.backLibrary}
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="section-title text-2xl md:text-3xl">{book.title}</h1>
        <EditionPicker
          bookId={id}
          variants={variants}
          selected={edition.id}
          locale={locale}
          reader
        />
      </div>

      {/* Reader immediately at top */}
      <div className="reader-workspace flex flex-col gap-8">
        <PdfReader
          key={edition.id}
          bookId={id}
          variantId={edition.id}
          initialPage={Math.min(startPage, edition.page_count ?? 100000)}
          initialBookmarks={bookmarks.data.map((b) => b.page_number)}
        />

        {/* Book Information Section below the book */}
        <section
          className="surface-card book-details-panel border border-[var(--line)] bg-[var(--surface)] p-6 rounded-lg"
          aria-label={t.aboutMaterial}
        >
          <h2 className="section-title text-xl mb-4 text-[var(--accent)] font-semibold">
            {t.aboutMaterial}
          </h2>
          <dl className="grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3 rounded overflow-hidden">
            {infoRows.map(([term, value]) => (
              <div className="bg-[var(--surface)] p-4" key={String(term)}>
                <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  {term}
                </dt>
                <dd className="mt-1 font-medium text-[var(--ink)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* AI Study Panel below the book and info */}
        <div className="ai-study-wrapper">
          <AiStudyPanel
            key={edition.id + "-ai"}
            variantId={edition.id}
            initialPage={Math.min(startPage, edition.page_count ?? 1000)}
            totalPages={edition.page_count}
            config={{
              enabled: ai.enabled,
              maxPages: ai.maxPages,
              maxChars: ai.maxChars,
              dailyLimit: ai.dailyLimit,
            }}
          />
        </div>
      </div>
    </SiteShell>
  );
}
