import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { getReading } from "@/lib/queries";
import { BookmarkRemove } from "./bookmark-remove";
import { BookCover } from "./book-cover";

export async function ReadingList({
  bookmarks = false,
  limit,
  reading: suppliedReading,
}: {
  bookmarks?: boolean;
  limit?: number;
  reading?: Awaited<ReturnType<typeof getReading>>;
}) {
  const { t } = await getI18n();
  const reading = suppliedReading ?? await getReading();
  const entries = bookmarks
    ? reading.bookmarks
    : reading.progress;

  if (!entries.length) {
    return (
      <p className="py-6 text-[var(--muted)]">
        {bookmarks ? t.noBookmarks : t.noProgress}
      </p>
    );
  }

  const books = new Map(
    reading.books.map((book) => [book.id, book]),
  );

  return (
    <ul className="divide-y divide-[var(--line)]">
      {entries.slice(0, limit).map((entry) => {
        const book = books.get(entry.book_id);

        return (
          <li
            className="reading-item py-5"
            key={entry.book_id + "-" + entry.page_number}
          >
            {!bookmarks && book && (
              <BookCover
                key={book.id}
                title={book.title}
                url={book.cover_url}
                bookId={book.book_id}
                variantId={book.id}
              />
            )}

            <div>
              {book ? (
                <Link
                  className="text-link font-semibold"
                  href={
                    "/books/" +
                    book.book_id +
                    "/read?variant=" +
                    book.id +
                    "&page=" +
                    entry.page_number
                  }
                >
                  {book.title} · {book.language}
                </Link>
              ) : (
                <p>{t.unavailableBook}</p>
              )}

              <p className="text-sm text-[var(--muted)]">
                {t.page} {entry.page_number}
              </p>

              {bookmarks && (
                <BookmarkRemove
                  bookId={entry.book_id}
                  page={entry.page_number}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
