import Link from "next/link";
import {getTimetableMaterials} from "@/lib/schedule-material-queries";
import {classGrade} from "@/lib/book-model";
import {getNonSchoolDays} from "@/lib/calendar-queries";
import {getI18n} from "@/lib/i18n-server";
import {designCopy} from "@/lib/design-copy";
import {HomeMotion} from "@/components/home-motion";
import {HomeStudyDashboard} from "@/components/home-study-dashboard";
import {SiteShell} from "@/components/site-shell";
import {EmptyState,SectionLink} from "@/components/ui";
import {ReadingList} from "@/components/reading-list";
import {RecentReading} from "@/components/recent-reading";
import {getViewer} from "@/lib/auth";
import {getCatalogOptions,getReading} from "@/lib/queries";
import {getWeeklySchedule} from "@/lib/weekly-queries";
import {schoolDate} from "@/lib/validation";

export default async function Home() {
  const {t,locale}=await getI18n(),c=designCopy(locale),viewer=await getViewer();
  const {classes,subjects}=viewer.user?await getCatalogOptions():{classes:[],subjects:[]};
  const classId=viewer.profile?.class_id??"",grade=classGrade(classes.find(item=>item.id===classId));
  const now=new Date(),today=schoolDate(now);
  const [lessons,nonSchoolDays,reading]=await Promise.all([
    classId?getWeeklySchedule(classId):Promise.resolve([]),
    viewer.user?getNonSchoolDays():Promise.resolve([]),
    viewer.user?getReading():Promise.resolve(null),
  ]);
  const materials=viewer.user&&classId?await getTimetableMaterials([...new Set(lessons.map(l=>l.subject_id))],[grade]):{};
  return <SiteShell><HomeMotion>
    <header className="dashboard-heading"><div><p className="eyebrow">{c.welcome}</p>
      <h1>{viewer.profile?.display_name?c.hello+", "+viewer.profile.display_name:"NIS Hub"}</h1></div>
      {classId&&<span className="status-chip">{classes.find(item=>item.id===classId)?.name}</span>}
    </header>
    {viewer.user&&reading?<HomeStudyDashboard lessons={lessons} subjects={subjects} classId={classId} today={today} nonSchoolDays={nonSchoolDays} grade={grade} materials={materials}
      time={new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Oral",hour:"2-digit",minute:"2-digit",hour12:false}).format(now)}
      reading={<ReadingList limit={3} reading={reading}/>} activity={<RecentReading reading={reading}/>}/>:
      <section className="guest-study surface-card"><p>{c.guest}</p><div className="flex flex-wrap gap-3 my-6"><Link href="/login" className="button">{t.login}</Link><Link href="/signup" className="button button-secondary">{t.signup}</Link></div>
        <EmptyState title={viewer.configured?t.afterLogin:t.preparing}>{viewer.configured?t.afterLoginHint:t.notConfigured}{!viewer.configured&&<SectionLink href="/setup">{t.setup}</SectionLink>}</EmptyState>
      </section>}
  </HomeMotion></SiteShell>;
}
