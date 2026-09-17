import {AiStudyPanel} from "@/components/ai-study-panel";
import {aiStudyConfig} from "@/lib/ai-study-config";
import {EditionPicker} from "@/components/edition-picker";
import {selectEdition} from "@/lib/editions";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PdfReader } from "@/components/pdf-reader";
import { requireViewer } from "@/lib/auth";
import { database, getBook, getBookVariants } from "@/lib/queries";
import { pageSchema } from "@/lib/validation";
export default async function ReadPage({ params, searchParams }: {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        page?: string; variant?:string;
    }>;
}) {
    const { t,locale } = await getI18n();
    const { id } = await params;
    const { user } = await requireViewer(`/books/${id}/read`);
    const book = await getBook(id);
    if (!book)
        notFound();
    const variants=await getBookVariants(id), query=await searchParams;
    const edition=selectEdition(variants,id,query.variant);if(!edition)notFound();
    const supabase = await database();
    const [progress, bookmarks] = await Promise.all([
        supabase.from("variant_reading_progress").select("page_number").eq("profile_id", user.id).eq("book_variant_id", edition.id).maybeSingle(),
        supabase.from("variant_bookmarks").select("page_number").eq("profile_id", user.id).eq("book_variant_id", edition.id).order("page_number"),
    ]);
    if (progress.error || bookmarks.error)
        throw new Error("Не удалось загрузить настройки чтения.");
    const requested = pageSchema.safeParse((await searchParams).page);
    const ai=aiStudyConfig();
    const startPage = requested.success ? requested.data : progress.data?.page_number ?? 1;
    return <SiteShell><Link className="text-sm underline" href={`/books/${id}`}>{t.aboutMaterial}</Link><h1 className="section-title mt-6 mb-8">{book.title}</h1><EditionPicker bookId={id} variants={variants} selected={edition.id} locale={locale} reader/><div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]"><PdfReader key={edition.id} bookId={id} variantId={edition.id} initialPage={Math.min(startPage, edition.page_count ?? 100000)} initialBookmarks={bookmarks.data.map(b => b.page_number)}/><AiStudyPanel key={edition.id+"-ai"} variantId={edition.id} initialPage={Math.min(startPage,edition.page_count??1000)} totalPages={edition.page_count} config={{enabled:ai.enabled,maxPages:ai.maxPages,maxChars:ai.maxChars,dailyLimit:ai.dailyLimit}}/></div></SiteShell>;
}
