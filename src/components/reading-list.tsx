import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { getReading } from "@/lib/queries";
import { BookmarkRemove } from "@/components/bookmark-remove";
export async function ReadingList({ bookmarks = false }: {
    bookmarks?: boolean;
}) {
    const { t } = await getI18n();
    const reading = await getReading();
    const entries = bookmarks ? reading.bookmarks : reading.progress;
    if (!entries.length)
        return <p className="py-6 text-[var(--muted)]">{bookmarks ? t.noBookmarks : t.noProgress}</p>;
    return <ul className="divide-y divide-[var(--line)]">{entries.map(entry => {
            const book = reading.books.find(item => item.id === entry.book_id);
            return <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={entry.book_id + "-" + entry.page_number}>
      {book ? <Link className="underline underline-offset-4" href={"/books/" + book.id + "/read?page=" + entry.page_number}>{book.title}<span className="block text-sm text-[var(--muted)]">{t.page + " "}{entry.page_number}</span></Link> : <p>{t.unavailableBook}<span className="block text-sm text-[var(--muted)]">{t.page + " "}{entry.page_number}</span></p>}
      {bookmarks && <BookmarkRemove bookId={entry.book_id} page={entry.page_number}/>}
    </li>;
        })}</ul>;
}
