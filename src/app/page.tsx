import { HomeTimetable } from "@/components/home-timetable";
import { getNonSchoolDays } from "@/lib/calendar-queries";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { EmptyState, PageIntro, SectionLink } from "@/components/ui";
import { ReadingList } from "@/components/reading-list";
import { getViewer } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/queries";
import { getWeeklySchedule } from "@/lib/weekly-queries";
import { schoolDate } from "@/lib/validation";
export default async function Home() {
    const { t } = await getI18n();
    const viewer = await getViewer();
    if (!viewer.user)
        return <SiteShell><PageIntro kicker={t.learningSpace} title="NIS Hub">{t.homeHint}</PageIntro><div className="mt-8 flex flex-wrap gap-3"><Link className="button" href="/login">{t.login}</Link><Link className="button button-secondary" href="/signup">{t.signup}</Link></div><div className="mt-12"><EmptyState title={viewer.configured ? t.afterLogin : t.preparing}>{viewer.configured ? t.afterLoginHint : t.notConfigured}{!viewer.configured && <div className="mt-4"><SectionLink href="/setup">{t.setup}</SectionLink></div>}</EmptyState></div></SiteShell>;
    const { classes, subjects } = await getCatalogOptions();
    const classId = viewer.profile?.class_id;
    const date = schoolDate();
    const [lessons, nonSchoolDays] = await Promise.all([classId ? getWeeklySchedule(classId) : Promise.resolve([]), getNonSchoolDays()]);
    return <SiteShell><PageIntro kicker={classes.find(item => item.id === classId)?.name ?? t.yourSpace} title={viewer.profile?.display_name ? t.hello + viewer.profile.display_name : t.yourDay}>{date}</PageIntro><div className="mt-10 grid gap-10 lg:grid-cols-2"><section className="border-t-2 border-[var(--ink)] pt-5"><HomeTimetable lessons={lessons} subjects={subjects} classId={classId ?? ""} today={date} nonSchoolDays={nonSchoolDays}/><SectionLink href="/schedule">{t.allSchedule}</SectionLink></section><section className="border-t-2 border-[var(--ink)] pt-5"><h2 className="section-title">{t.continueReading}</h2><ReadingList /><SectionLink href="/library">{t.openLibrary}</SectionLink></section></div></SiteShell>;
}
