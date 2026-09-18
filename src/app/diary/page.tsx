import { requireViewer } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { communityCopy } from "@/lib/community-copy";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { DiaryPanel } from "@/components/diary-panel";
export default async function DiaryPage() {
  await requireViewer("/diary");
  const { locale } = await getI18n(),
    p = communityCopy(locale);
  return (
    <SiteShell>
      <PageIntro title={p.diary}>{p.demo}</PageIntro>
      <DiaryPanel />
    </SiteShell>
  );
}
