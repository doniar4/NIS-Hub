import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { getReading } from "@/lib/queries";
import { BookmarkRemove } from "./bookmark-remove";
import {BookCover} from "./book-cover";
export async function ReadingList({bookmarks=false}:{bookmarks?:boolean}){
 const {t}=await getI18n(),reading=await getReading(),entries=bookmarks?reading.bookmarks:reading.progress;
 if(!entries.length)return <p className="py-6 text-[var(--muted)]">{bookmarks?t.noBookmarks:t.noProgress}</p>;
 const books=new Map(reading.books.map(book=>[book.id,book]));
 return <ul className="divide-y divide-[var(--line)]">{entries.map(entry=>{
 const book=books.get(entry.book_id);
 return <li className="reading-item py-5" key={entry.book_id+"-"+entry.page_number}>
 {!bookmarks&&book&&<BookCover key={book.cover_url} title={book.title} url={book.cover_url}/>}
 <div>{book?<Link className="text-link font-semibold" href={"/books/"+book.id+"/read?page="+entry.page_number}>{book.title}</Link>:<p>{t.unavailableBook}</p>}
 <p className="text-sm text-[var(--muted)]">{t.page} {entry.page_number}</p>
 {bookmarks&&<BookmarkRemove bookId={entry.book_id} page={entry.page_number}/>}</div></li>;
 })}</ul>;
}
