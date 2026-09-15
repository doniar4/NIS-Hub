import {BotanicalLines} from "@/components/brand";
import {v05Copy} from "@/lib/v05-copy";
import {classGrade} from "@/lib/book-model";
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
    const { t, locale } = await getI18n(); const p=v05Copy(locale);
    const viewer = await getViewer();
    if (!viewer.user)
        return <SiteShell><PageIntro kicker={t.learningSpace} title="NIS Hub">{t.homeHint}</PageIntro><div className="mt-8 flex flex-wrap gap-3"><Link className="button" href="/login">{t.login}</Link><Link className="button button-secondary" href="/signup">{t.signup}</Link></div><div className="mt-12"><EmptyState title={viewer.configured ? t.afterLogin : t.preparing}>{viewer.configured ? t.afterLoginHint : t.notConfigured}{!viewer.configured && <div className="mt-4"><SectionLink href="/setup">{t.setup}</SectionLink></div>}</EmptyState></div></SiteShell>;
    const { classes, subjects } = await getCatalogOptions();
    const classId = viewer.profile?.class_id;
    const date = schoolDate();
    const [lessons, nonSchoolDays] = await Promise.all([classId ? getWeeklySchedule(classId) : Promise.resolve([]), getNonSchoolDays()]);
    return <SiteShell><div className="home-greeting"><BotanicalLines className="greeting-botanical"/><PageIntro kicker={classes.find(item => item.id === classId)?.name ?? t.yourSpace} title={viewer.profile?.display_name ? p.greeting + ", " + viewer.profile.display_name : t.yourDay}>{p.tagline}</PageIntro></div><div className="home-panels mt-10 grid gap-6 xl:grid-cols-[1.15fr_1fr]"><section className="surface-card home-panel"><HomeTimetable grade={classGrade(classes.find(c=>c.id===classId))} lessons={lessons} subjects={subjects} classId={classId ?? ""} today={date} nonSchoolDays={nonSchoolDays}/><SectionLink href="/schedule">{t.allSchedule}</SectionLink></section><section className="surface-card home-panel"><h2 className="section-title">{t.continueReading}</h2><ReadingList /><SectionLink href="/library">{t.openLibrary}</SectionLink></section></div></SiteShell>;
}
