import { getCatalogOptions } from "@/lib/queries";
import { requireViewer } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { v053Copy } from "@/lib/v053-copy";
import { findPeople } from "@/app/actions/people";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { PeopleBrowser } from "@/components/people-browser";
import { CommunityNav } from "@/components/community-nav";
export default async function FriendsPage({searchParams}:{searchParams:Promise<{tab?:string}>}){await requireViewer("/friends");const {tab}=await searchParams,scope=tab==="requests"?"requests":tab==="blocked"?"blocked":"friends";const {locale}=await getI18n(),p=v053Copy(locale),result=await findPeople(scope);const {subjects}=await getCatalogOptions();return <SiteShell><PageIntro title={p.friends}/><CommunityNav locale={locale}/><nav className="community-nav"><a href="/friends">{p.friends}</a><a href="/friends?tab=requests">{p.requests}</a><a href="/friends?tab=blocked">{p.blocked}</a></nav>{"error"in result?<p role="alert">{p[result.error]}</p>:<PeopleBrowser subjects={subjects} key={scope} initial={result.data} scope={scope}/>}</SiteShell>;}
