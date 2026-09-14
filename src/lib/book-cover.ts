/** A cover must be an actual private image associated with this book, not an invented URL. */
export function coverPath(book:{id:string;cover_path:string|null}):string|null {
 if(!book.cover_path)return null;
 return ["webp","png","jpg","jpeg"].some(ext=>book.cover_path==="books/"+book.id+"."+ext)?book.cover_path:null;
}
