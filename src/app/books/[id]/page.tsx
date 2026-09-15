import {subjectName} from "@/lib/i18n";
import {getI18n} from "@/lib/i18n-server";
import Link from "next/link";
import {notFound} from "next/navigation";
import {SiteShell} from "@/components/site-shell";
import {PageIntro} from "@/components/ui";
import {EditionPicker} from "@/components/edition-picker";
import {getBook,getBookVariants,getCatalogOptions} from "@/lib/queries";
import {selectEdition} from "@/lib/editions";
import {v051Copy} from "@/lib/v051-copy";
export default async function BookPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{variant?:string}>}){
 const {t,locale}=await getI18n(),p=v051Copy(locale),{id}=await params;
 const book=await getBook(id);if(!book)notFound();
 const [variants,{subjects}]=await Promise.all([getBookVariants(id),getCatalogOptions()]);
 const edition=selectEdition(variants,id,(await searchParams).variant);if(!edition)notFound();
 const rows=[[t.subject,subjectName(subjects.find(s=>s.id===book.subject_id),locale)],[p.grade,book.grade],[t.author,book.author],[t.publisher,book.publisher],[t.year,book.publication_year],[t.pages,edition.page_count]].filter(([,v])=>v!=null);
 return <SiteShell><Link className="text-link" href="/library">{t.backLibrary}</Link><div className="mt-8"><PageIntro kicker={t.material} title={book.title}>{t.pdfHint}</PageIntro></div>
 <EditionPicker bookId={id} variants={variants} selected={edition.id} locale={locale}/>
 <dl className="my-8 grid max-w-3xl gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">{rows.map(([term,value])=><div className="bg-[var(--surface)] p-5" key={term}><dt className="text-sm text-[var(--muted)]">{term}</dt><dd className="mt-1">{value}</dd></div>)}</dl>
 <Link className="button" href={`/books/${id}/read?variant=${edition.id}`}>{t.readPdf}</Link></SiteShell>;
}
