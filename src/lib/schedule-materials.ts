import { filterBooks,type LibraryBook } from "./library";
import { librarySubjectHref } from "./book-model";
export type MaterialEdition={id:string;book_id:string};
export type MaterialMap=Record<string,string>;
export const materialKey=(subject:string,grade:number|null)=>String(grade??"")+":"+subject;
export function materialDestinations(books:LibraryBook[],editions:MaterialEdition[],recent:string[],subjects:string[],grades:(number|null)[],truncated=false):MaterialMap{
 const result:MaterialMap={};
 for(const grade of grades)for(const subject of subjects){
 const fallback=librarySubjectHref(subject,grade),key=materialKey(subject,grade);
 const matching=filterBooks(books,{q:"",subject,grade:grade?String(grade):""});
 if(truncated||matching.length!==1){result[key]=fallback;continue;}
 const book=matching[0],variants=editions.filter(v=>v.book_id===book.id);
 const selected=recent.map(id=>variants.find(v=>v.id===id)).find(Boolean)??(variants.length===1?variants[0]:undefined);
 result[key]=selected?"/books/"+book.id+"/read?variant="+selected.id:"/books/"+book.id;
 }
 return result;
}
