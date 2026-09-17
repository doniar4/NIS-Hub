import type {BookVariant} from "./database.types";
export function selectEdition(variants:BookVariant[],bookId:string,requested?:string):BookVariant|undefined{
 return requested?variants.find(v=>v.id===requested&&v.book_id===bookId):variants.find(v=>v.id===bookId)??variants[0];
}
