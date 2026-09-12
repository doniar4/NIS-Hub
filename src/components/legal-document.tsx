import Link from "next/link";
import { SiteShell } from "./site-shell";
import { PageIntro, Notice } from "./ui";
import { getI18n } from "@/lib/i18n-server";
import { legalCopy } from "@/lib/legal-copy";
export async function LegalDocument({ kind }: { kind: "privacy" | "terms" }) {
  const { locale, t } = await getI18n();
  const copy = legalCopy[locale];
  return <SiteShell><PageIntro kicker={copy.draft} title={kind === "privacy" ? copy.privacyTitle : copy.termsTitle}>{copy.intro}</PageIntro>
    <div className="mt-8"><Notice>{copy.revision}</Notice></div>
    <article className="prose-doc mt-10 max-w-3xl space-y-8">{copy[kind].map(([heading, body]) =>
      <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}</article>
    <p className="mt-10"><Link className="underline" href={kind === "privacy" ? "/terms" : "/privacy"}>{kind === "privacy" ? t.terms : t.privacy}</Link></p>
  </SiteShell>;
}
