import type {ClassRow} from "./database.types";
export const BOOK_GRADES = [7,8,9,10,11,12] as const;
export const EDITION_LANGUAGES = ["ru","kz","en","und"] as const;
export type EditionLanguage = typeof EDITION_LANGUAGES[number];
export function classGrade(row: Pick<ClassRow,"grade"|"name"> | undefined): number | null {
 if(!row)return null;
 const grade=row.grade ?? Number(row.name.trim().match(/^(\d{1,2})(?!\d)/)?.[1]);
 return Number.isInteger(grade)&&grade>=1&&grade<=12?grade:null;
}
export function librarySubjectHref(subject: string, grade: number | null): string {
 return "/library?"+new URLSearchParams({subject,grade:grade?String(grade):""}).toString();
}
export function editionLanguage(value: string|null|undefined): EditionLanguage {
 const name=value?.trim().toLowerCase();
 if(["ru","rus","russian","русский","рус"].includes(name??""))return "ru";
 if(["kk","kz","kaz","kazakh","қазақша","қазақ тілі","казахский"].includes(name??""))return "kz";
 if(["en","eng","english","английский"].includes(name??""))return "en";
 return "und";
}
