
import { getTimetableMaterials } from "@/lib/schedule-material-queries";
import { classGrade } from "@/lib/book-model";
import { getNonSchoolDays } from "@/lib/calendar-queries";
import { getI18n } from "@/lib/i18n-server";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { StudentSchedule } from "@/components/student-schedule";
import { requireViewer } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/queries";
import { getWeeklySchedule } from "@/lib/weekly-queries";
import { schoolDate, dateSchema } from "@/lib/validation";
import { phase4Copy } from "@/lib/phase4-copy";
export default async function SchedulePage({searchParams}:{searchParams:Promise<{date?:string}>}) {
  const requestedDate=dateSchema.safeParse((await searchParams).date);
  const date=requestedDate.success?requestedDate.data:schoolDate();
  const { t, locale } = await getI18n(); const { profile,user } = await requireViewer("/schedule");
  const [{ classes,subjects }, lessons, nonSchoolDays] = await Promise.all([getCatalogOptions(),getWeeklySchedule(),getNonSchoolDays()]);
  const materials=await getTimetableMaterials([...new Set(lessons.map(l=>l.subject_id))],[...new Set(classes.map(classGrade))]);
  return <SiteShell><PageIntro kicker={t.schoolDay} title={t.schedule}>{phase4Copy(locale).weeklyHint}</PageIntro>
    <StudentSchedule userId={user.id} materials={materials} lessons={lessons} classes={classes} subjects={subjects} initialClassId={profile.class_id ?? ""} date={date} nonSchoolDays={nonSchoolDays}/>
  </SiteShell>;
}
