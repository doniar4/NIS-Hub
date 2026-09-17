import Link from "next/link";
import type {BookVariant} from "@/lib/database.types";
import type {Locale} from "@/lib/i18n";
import {v051Copy} from "@/lib/v051-copy";
export function EditionPicker({bookId,variants,selected,locale,reader=false}:{bookId:string;variants:BookVariant[];selected:string;locale:Locale;reader?:boolean}){
 const p=v051Copy(locale);
 return <div className="my-5"><p className="field-label">{p.edition}</p>{variants.length>1?<nav aria-label={p.edition} className="flex flex-wrap gap-3">{variants.map(v=><Link prefetch={false} className={"button "+(v.id===selected?"":"button-secondary")} aria-current={v.id===selected?"page":undefined} key={v.id} href={`/books/${bookId}${reader?"/read":""}?variant=${v.id}`}>{p[v.language]}</Link>)}</nav>:<p>{variants[0]?p[variants[0].language]:p.und}</p>}<p className="mt-2 text-sm text-[var(--muted)]">{p.editionHint}</p></div>;
}
