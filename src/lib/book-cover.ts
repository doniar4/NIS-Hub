/** A cover must be an actual private image associated with this book, not an invented URL. */
export function coverPath(book:{id:string;book_id?:string;cover_path:string|null}):string|null {
 if(!book.cover_path)return null;
 const validIds = [book.id, book.book_id].filter(Boolean);
 return ["webp","png","jpg","jpeg"].some(ext=>validIds.some(id=>book.cover_path==="books/"+id+"."+ext))?book.cover_path:null;
}
