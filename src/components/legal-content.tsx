import Link from "next/link";
import { PageIntro, Notice } from "./ui";
import { dictionaries,type Locale } from "@/lib/i18n";
import { legalCopy } from "@/lib/legal-copy";
export function LegalContent({kind,locale}:{kind:"privacy"|"terms";locale:Locale}){
 const copy=legalCopy[locale],t=dictionaries[locale];
 return <><PageIntro kicker={copy.draft} title={kind==="privacy"?copy.privacyTitle:copy.termsTitle}>{copy.intro}</PageIntro>
 <div className="mt-8"><Notice>{copy.revision}</Notice></div>
 <article className="prose-doc mt-10 max-w-3xl space-y-8">{copy[kind].map(([heading,body])=><section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}</article>
 <p className="mt-10"><Link className="underline" href={kind==="privacy"?"/terms":"/privacy"}>{kind==="privacy"?t.terms:t.privacy}</Link></p></>;
}
