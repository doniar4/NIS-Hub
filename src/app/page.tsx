import { subjectName } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { EmptyState, PageIntro, SectionLink } from "@/components/ui";
import { ReadingList } from "@/components/reading-list";
import { getViewer } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/queries";
import { databaseSchedule } from "@/lib/schedule";
import { schoolDate } from "@/lib/validation";
export default async function Home() {
    const { t, locale } = await getI18n();
    const viewer = await getViewer();
    if (!viewer.user)
        return <SiteShell><PageIntro kicker={t.learningSpace} title="NIS Hub">{t.homeHint}</PageIntro><div className="mt-8 flex flex-wrap gap-3"><Link className="button" href="/login">{t.login}</Link><Link className="button button-secondary" href="/signup">{t.signup}</Link></div><div className="mt-12"><EmptyState title={viewer.configured ? t.afterLogin : t.preparing}>{viewer.configured ? t.afterLoginHint : t.notConfigured}{!viewer.configured && <div className="mt-4"><SectionLink href="/setup">{t.setup}</SectionLink></div>}</EmptyState></div></SiteShell>;
    const { classes, subjects } = await getCatalogOptions();
    const classId = viewer.profile?.class_id;
    const date = schoolDate();
    const lessons = classId ? await databaseSchedule.getDay(classId, date) : [];
    return <SiteShell><PageIntro kicker={classes.find(item => item.id === classId)?.name ?? t.yourSpace} title={viewer.profile?.display_name ? t.hello + viewer.profile.display_name : t.yourDay}>{date}</PageIntro><div className="mt-10 grid gap-10 lg:grid-cols-2"><section className="border-t-2 border-[var(--ink)] pt-5"><h2 className="section-title">{t.today}</h2>{lessons.length ? <ol className="mt-4 divide-y divide-[var(--line)]">{lessons.map(lesson => <li className="flex items-center gap-4 py-4" key={lesson.id}><span className="text-[var(--muted)]">{lesson.lesson_number}</span><span className="flex-1">{subjectName(subjects.find(item => item.id === lesson.subject_id), locale)}</span>{lesson.room && <span>{lesson.room}</span>}</li>)}</ol> : <p className="py-6 text-[var(--muted)]">{classId ? t.noToday : t.chooseProfileClass}</p>}<SectionLink href="/schedule">{t.allSchedule}</SectionLink></section><section className="border-t-2 border-[var(--ink)] pt-5"><h2 className="section-title">{t.continueReading}</h2><ReadingList /><SectionLink href="/library">{t.openLibrary}</SectionLink></section></div></SiteShell>;
}
