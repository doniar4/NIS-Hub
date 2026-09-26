import {getTimetableMaterials} from "@/lib/schedule-material-queries";
import {classGrade} from "@/lib/book-model";
import {getNonSchoolDays} from "@/lib/calendar-queries";
import {getI18n} from "@/lib/i18n-server";
import {designCopy} from "@/lib/design-copy";
import {HomeMotion} from "@/components/home-motion";
import {HomeStudyDashboard} from "@/components/home-study-dashboard";
import {SiteShell} from "@/components/site-shell";
import {ReadingList} from "@/components/reading-list";
import {RecentReading} from "@/components/recent-reading";
import {getViewer} from "@/lib/auth";
import {getCatalogOptions,getReading} from "@/lib/queries";
import {getWeeklySchedule} from "@/lib/weekly-queries";
import {schoolDate} from "@/lib/validation";
import {WelcomeScreen} from "@/components/welcome-screen";
import {getPersonalTasks} from "@/lib/task-queries";

export default async function Home() {
  const {t,locale}=await getI18n(),c=designCopy(locale),viewer=await getViewer();
  if(!viewer.user){
    return <WelcomeScreen t={t} configured={viewer.configured}/>;
  }
  const {classes,subjects}=await getCatalogOptions();
  const classId=viewer.profile?.class_id??"",grade=classGrade(classes.find(item=>item.id===classId));
  const now=new Date(),today=schoolDate(now);
  const [lessons,nonSchoolDays,reading,tasks]=await Promise.all([
    classId?getWeeklySchedule(classId):Promise.resolve([]),
    getNonSchoolDays(),
    getReading(),
    getPersonalTasks(20),
  ]);
  const materials=classId?await getTimetableMaterials([...new Set(lessons.map(l=>l.subject_id))],[grade]):{};
  return <SiteShell><HomeMotion>
    <header className="dashboard-heading"><div><p className="eyebrow">{c.welcome}</p>
      <h1>{viewer.profile?.display_name?c.hello+", "+viewer.profile.display_name:"NIS Hub"}</h1></div>
      {classId&&<span className="status-chip">{classes.find(item=>item.id===classId)?.name}</span>}
    </header>
    <HomeStudyDashboard lessons={lessons} subjects={subjects} tasks={tasks} classId={classId} today={today} nonSchoolDays={nonSchoolDays} grade={grade} materials={materials}
      time={new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Oral",hour:"2-digit",minute:"2-digit",hour12:false}).format(now)}
      reading={<ReadingList limit={3} reading={reading}/>} activity={<RecentReading reading={reading}/>}/>
  </HomeMotion></SiteShell>;
}
