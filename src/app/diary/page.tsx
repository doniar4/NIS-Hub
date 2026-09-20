import { requireViewer } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { getCatalogOptions } from "@/lib/queries";
import { smsCopy } from "@/lib/sms/copy";
import { smsEnabled } from "@/lib/sms/config";
import { hasSmsSession } from "@/lib/sms/session";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { SmsDiary } from "@/components/sms-diary";
export default async function DiaryPage() {
  await requireViewer("/diary");
  const {locale}=await getI18n(), p=smsCopy(locale);
  const {subjects}=await getCatalogOptions();
  return <SiteShell><PageIntro title={p.title}>{p.intro}</PageIntro>
    <SmsDiary enabled={smsEnabled()} sessionPresent={await hasSmsSession()} subjects={subjects}/>
  </SiteShell>;
}
