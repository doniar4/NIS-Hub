import { getCatalogOptions } from "@/lib/queries";
import { requireViewer } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { v053Copy } from "@/lib/v053-copy";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { PeopleBrowser } from "@/components/people-browser";
import { CommunityNav } from "@/components/community-nav";
export default async function PeoplePage(){await requireViewer("/people");const {locale}=await getI18n();const {subjects}=await getCatalogOptions();return <SiteShell><PageIntro title={v053Copy(locale).people}/><CommunityNav locale={locale}/><PeopleBrowser subjects={subjects}/></SiteShell>;}
