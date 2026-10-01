import type { Metadata } from "next";
import {getTimetableMaterials} from "@/lib/schedule-material-queries";
import {classGrade} from "@/lib/book-model";
import {getNonSchoolDays} from "@/lib/calendar-queries";
import {getI18n} from "@/lib/i18n-server";
import {designCopy} from "@/lib/design-copy";
import {HomeMotion} from "@/components/home-motion";
import {HomeStudyDashboard} from "@/components/home-study-dashboard";
import {SiteShell} from "@/components/site-shell";
import {ReadingList} from "@/components/reading-list";
import {RecentSmsGrades} from "@/components/recent-sms-grades";
import {AboutProject} from "@/components/about-project";
import {hasSmsSession} from "@/lib/sms/session";
import {getViewer} from "@/lib/auth";
import {getCatalogOptions,getReading} from "@/lib/queries";
import {getWeeklySchedule} from "@/lib/weekly-queries";
import {safeNext,schoolDate} from "@/lib/validation";
import {WelcomeScreen} from "@/components/welcome-screen";
import {getPersonalTasks} from "@/lib/task-queries";

import { absoluteSiteUrl } from "@/lib/site-url";
import { socialProviderEnabled } from "@/lib/auth-providers";

const publicTitle = "NIS Hub — Learning, Schedule, Books and Study Tools";
const publicDescription = "NIS Hub brings together school schedules, books, homework, community and study tools in one place.";

export async function generateMetadata(): Promise<Metadata> {
  const viewer = await getViewer();
  if (viewer.user) return { robots: { index: false, follow: false } };
  return {
    title: { absolute: publicTitle },
    description: publicDescription,
    alternates: { canonical: absoluteSiteUrl("/") },
    robots: { index: true, follow: true },
    openGraph: {
      title: publicTitle,
      description: publicDescription,
      siteName: "NIS Hub",
      url: absoluteSiteUrl("/"),
      type: "website",
    },
    twitter: { card: "summary", title: publicTitle, description: publicDescription },
  };
}

export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {t,locale}=await getI18n(),c=designCopy(locale),viewer=await getViewer();
  if(!viewer.user){
    const params=await searchParams,authMode=params.auth==="login"?"login":"signup";
    return <WelcomeScreen t={t} configured={viewer.configured} authMode={authMode}
      googleEnabled={viewer.configured && socialProviderEnabled("google")}
      callbackFailed={authMode==="login"&&params.callback==="failed"}
      loginNext={authMode==="login"?safeNext(params.next):"/"}
      confirmationFailed={authMode==="login"&&params.confirmation==="failed"}/>;
  }
  const {classes,subjects}=await getCatalogOptions();
  const classId=viewer.profile?.class_id??"",grade=classGrade(classes.find(item=>item.id===classId));
  const now=new Date(),today=schoolDate(now);
  const [lessons,nonSchoolDays,reading,tasks,smsConnected]=await Promise.all([
    classId?getWeeklySchedule(classId):Promise.resolve([]),
    getNonSchoolDays(),
    getReading(),
    getPersonalTasks(20),
    hasSmsSession(),
  ]);
  const materials=classId?await getTimetableMaterials([...new Set(lessons.map(l=>l.subject_id))],[grade]):{};
  return <SiteShell><HomeMotion>
    <header className="dashboard-heading"><div><p className="eyebrow">{c.welcome}</p>
      <h1>{viewer.profile?.display_name?c.hello+", "+viewer.profile.display_name:"NIS Hub"}</h1></div>
      {classId&&<span className="status-chip">{classes.find(item=>item.id===classId)?.name}</span>}
    </header>
    <HomeStudyDashboard lessons={lessons} subjects={subjects} tasks={tasks} classId={classId} today={today} nonSchoolDays={nonSchoolDays} grade={grade} materials={materials}
      time={new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Oral",hour:"2-digit",minute:"2-digit",hour12:false}).format(now)}
      reading={<ReadingList limit={3} reading={reading}/>} activity={<RecentSmsGrades subjects={subjects} sessionPresent={smsConnected}/>}/>
    <AboutProject locale={locale}/>
  </HomeMotion></SiteShell>;
}
