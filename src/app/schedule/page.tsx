import { getI18n } from "@/lib/i18n-server";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { WeeklyScheduleBrowser } from "@/components/weekly-schedule";
import { requireViewer } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/queries";
import { getWeeklySchedule } from "@/lib/weekly-queries";
import { schoolDate } from "@/lib/validation";
import { phase4Copy } from "@/lib/phase4-copy";
export default async function SchedulePage() {
  const { t, locale } = await getI18n(); const { profile } = await requireViewer("/schedule");
  const [{ classes,subjects }, lessons] = await Promise.all([getCatalogOptions(),getWeeklySchedule()]);
  return <SiteShell><PageIntro kicker={t.schoolDay} title={t.schedule}>{phase4Copy(locale).weeklyHint}</PageIntro>
    <WeeklyScheduleBrowser lessons={lessons} classes={classes} subjects={subjects} initialClassId={profile.class_id ?? ""} date={schoolDate()}/>
  </SiteShell>;
}
