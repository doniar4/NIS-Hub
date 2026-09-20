import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/queries";
import { getI18n } from "@/lib/i18n-server";
import { v053Copy } from "@/lib/v053-copy";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { ReportModeration } from "@/components/report-moderation";
export default async function CommunityModeration(){await requireAdmin();const {locale}=await getI18n(),p=v053Copy(locale),db=await database(),{data,error}=await db.from("community_reports").select("*").eq("status","open").order("created_at").limit(50);
 return <SiteShell><PageIntro title={p.moderation}/>{error?<p role="alert">{p.failed}</p>:<ReportModeration reports={data}/>}</SiteShell>;
}
