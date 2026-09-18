import { SiteShell } from "@/components/site-shell";
import { PencilStudyLoader } from "@/components/loaders/contextual-loaders";
import { getI18n } from "@/lib/i18n-server";

export default async function ScheduleLoading() {
  const { t } = await getI18n();
  return (
    <SiteShell>
      <div className="page-intro">
        <h1 className="page-title">{t.schedule}</h1>
      </div>
      <PencilStudyLoader kind="schedule" />
    </SiteShell>
  );
}
