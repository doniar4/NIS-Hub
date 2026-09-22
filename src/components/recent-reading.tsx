import Link from "next/link";
import {getI18n} from "@/lib/i18n-server";
import type {getReading} from "@/lib/queries";
import {designCopy} from "@/lib/design-copy";

export async function RecentReading({reading}:{reading:Awaited<ReturnType<typeof getReading>>}) {
  const {locale,t}=await getI18n();
  return <section className="surface-card recent-reading"><h2 className="section-title">{designCopy(locale).activity}</h2>
    {!reading.progress.length?<p className="py-6 text-[var(--muted)]">{t.noProgress}</p>:<ul className="compact-entries">{reading.progress.slice(0,3).map(entry=>{
      const book=reading.books.find(b=>b.id===entry.book_id);
      return <li key={entry.book_id}><span className="activity-dot" aria-hidden="true"/><div>{book?<Link className="text-link" href={"/books/"+book.book_id+"/read?variant="+book.id+"&page="+entry.page_number}>{book.title}</Link>:<p>{t.unavailableBook}</p>}
        <p>{t.page} {entry.page_number}</p><time dateTime={entry.updated_at}>{new Intl.DateTimeFormat(locale,{timeZone:"Asia/Oral",dateStyle:"medium",timeStyle:"short"}).format(new Date(entry.updated_at))}</time></div></li>;
    })}</ul>}
  </section>;
}
