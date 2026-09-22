// Test-only route composition. Production components; synthetic authenticated transport.
import Link from "next/link";
import {createRoot} from "react-dom/client";
import {useState} from "react";
import {AppFrame} from "../../src/components/app-frame";
import {LocaleProvider} from "../../src/components/locale-provider";
import {PreferenceControls} from "../../src/components/preference-controls";
import {HomeStudyDashboard} from "../../src/components/home-study-dashboard";
import {StudentSchedule} from "../../src/components/student-schedule";
import {LibraryBrowser} from "../../src/components/library-browser";
import {ReaderWorkspace} from "../../src/components/reader-workspace";
import {PdfReader} from "../../src/components/pdf-reader";
import {AiStudyPanel} from "../../src/components/ai-study-panel";
import {SmsDiary} from "../../src/components/sms-diary";
import {ProfilePortrait} from "../../src/components/profile-portrait";
import {TopSubjects} from "../../src/components/top-subjects";
import {AvatarForm} from "../../src/components/avatar-form";
import {TicketConversation} from "../../src/components/ticket-conversation";
import {AdminDashboard} from "../../src/components/admin-dashboard";
import {BookEditor} from "../../src/components/book-editor";
import {EduPageSync} from "../../src/components/edupage-sync";
import {NotificationCenter} from "../../src/components/notification-center";
import {PageIntro} from "../../src/components/ui";
import {parseLocale,dictionaries} from "../../src/lib/i18n";
import {initialLibraryFilters} from "../../src/lib/library";
import {designCopy} from "../../src/lib/design-copy";
import {materialKey} from "../../src/lib/schedule-materials";
import type {WeeklyLesson,SupportTicket} from "../../src/lib/database.types";
import {books,classes,subjects} from "./fixtures";
const id="00000000-0000-4000-8000-000000000030";
const lessons:WeeklyLesson[]=Array.from({length:5},(_,day)=>[0,1,2].map(n=>({
  id:day+"-"+n,class_id:classes[0].id,weekday:day+1,subject_id:subjects[n===2?1:n].id,
  lesson_start:n===2?1:n*2+1,lesson_end:n===2?2:n*2+2,start_time:n===1?"10:15":"08:30",end_time:n===1?"11:45":"10:10",
  room:n===1?"248":"305",teacher:"MUST NOT DISPLAY",subgroup_label:n!==1?"Group "+(n===0?"A":"B"):null,
  effective_from:null,effective_to:null,created_at:"",updated_at:""
}))).flat();
const nonSchoolDays=[{start_date:"2026-09-21",end_date:"2026-09-21",type:"holiday" as const,label:"School holiday"}];
const success=async()=>({success:"Saved (fixture)"});
const ticket:SupportTicket={id,owner_id:id,category:"library",title:"Long support ticket title — unable to open a textbook on a small screen",description:"Synthetic support content. No personal data.",status:"open",created_at:"2026-09-18T09:00:00Z",updated_at:"2026-09-18T09:00:00Z",last_user_message_at:"2026-09-18T09:00:00Z",last_admin_message_at:null,needs_admin_reply:true};
function Harness() {
  const params=new URLSearchParams(location.search);
  const [locale,setLocale]=useState(parseLocale(params.get("locale")||"en"));
  const t=dictionaries[locale],c=designCopy(locale),path=location.pathname;
  const initial=(window as unknown as {fixtureReading:{page:number;bookmarks:number[]}}).fixtureReading;
  const empty=<p className="py-6">{t.noProgress}</p>;
  const material={[materialKey(subjects[0].id,classes[0].grade)]:"/books/"+id+"/read?variant="+id};
  return <LocaleProvider locale={locale}><AppFrame admin={path==="/admin"} preferences={<PreferenceControls localeAction={async value=>{setLocale(parseLocale(value));document.documentElement.lang=value;return {ok:true};}}/>}
    avatar={<NotificationCenter/>} account={<form><button className="button button-secondary">{t.logout}</button></form>} profileAccount={<span>Synthetic Student</span>}>
    {path==="/" ? <><header className="dashboard-heading"><div><p className="eyebrow">{c.welcome}</p><h1>{c.hello}, Synthetic Student</h1></div><span className="status-chip">{classes[0].name}</span></header>
      <HomeStudyDashboard lessons={lessons} subjects={subjects} classId={classes[0].id} today="2026-09-18" time="09:00" nonSchoolDays={nonSchoolDays} grade={classes[0].grade} materials={material}
        reading={empty} activity={<section className="surface-card"><h2 className="section-title">{c.activity}</h2>{empty}</section>}/></>:
    path==="/schedule"?<><PageIntro title={t.schedule}/><StudentSchedule userId={id} lessons={lessons} classes={classes} subjects={subjects} initialClassId={classes[0].id} date="2026-09-18" materials={material} nonSchoolDays={nonSchoolDays}/></>:
    path==="/library"?<><PageIntro title={t.library}/><LibraryBrowser books={books} classes={classes} subjects={subjects} initial={initialLibraryFilters(Object.fromEntries(params))} truncated={false} studyIntent={params.get("study")==="1"}/></>:
    path.startsWith("/books/")?<><PageIntro title="Reader · real local test PDF"/><ReaderWorkspace information={<p>Local PDF fixture, private transport simulated.</p>} inspector={<AiStudyPanel variantId={id} totalPages={4} initialPage={1} defaultOpen config={{enabled:true,maxPages:10,maxChars:30000,dailyLimit:10}}/>}>
      <PdfReader bookId={id} variantId={id} initialPage={initial.page} initialBookmarks={initial.bookmarks}/></ReaderWorkspace></>:
    path==="/diary"?<><PageIntro title="SMS Diary"/><SmsDiary enabled sessionPresent subjects={subjects}/></>:
    path==="/profile"?<><div className="profile-heading surface-card"><ProfilePortrait url={null} name="Synthetic Student"/><PageIntro title="Synthetic Student">{t.profileHint}</PageIntro></div>
      <div className="profile-settings"><form className="surface-card space-y-5"><label><span className="field-label">{t.displayName}</span><input className="field" defaultValue="Synthetic Student"/></label><label><span className="field-label">{t.class}</span><select className="field">{classes.map(row=><option key={row.id}>{row.name}</option>)}</select></label><TopSubjects subjects={subjects} initial={[subjects[0].id]}/></form><AvatarForm url={null} action={success}/></div></>:
    path==="/support"?<div className="support-workspace support-detail"><aside className="surface-card support-list"><h2>{t.title}</h2><Link className="text-link" href="/support">{ticket.title}</Link></aside><section className="support-active"><TicketConversation ticket={ticket} messages={[]} events={[]} locale={locale} admin={false} replyAction={success} statusAction={success}/></section></div>:
    <><AdminDashboard locale={locale} open={1} unread={1} recent={[]}/><EduPageSync initial={{enabled:true,ready:true,lastChecked:null,lastSynced:null,activeVersion:null,error:null,aliases:{classes:{},subjects:{}}}} classes={classes} subjects={subjects}/>
      <div className="admin-workspace"><section className="surface-card admin-records"><h2>{t.title}</h2>{books.slice(0,5).map(book=><p key={book.id}>{book.title}</p>)}</section><section className="surface-card admin-editor"><BookEditor id={id} classes={classes} subjects={subjects} action={success}/></section></div></>}
  </AppFrame></LocaleProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
