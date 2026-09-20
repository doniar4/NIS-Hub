import { SiteShell } from "./site-shell";
import { getI18n } from "@/lib/i18n-server";
import { LegalContent } from "./legal-content";
export async function LegalDocument({kind}:{kind:"privacy"|"terms"}){const {locale}=await getI18n();return <SiteShell><LegalContent kind={kind} locale={locale}/></SiteShell>;}
