import {createRoot} from "react-dom/client";
import {useState} from "react";
import {LocaleProvider} from "../../src/components/locale-provider";
import {AppFrame} from "../../src/components/app-frame";
import {PreferenceControls} from "../../src/components/preference-controls";
import {HomeTimetable} from "../../src/components/home-timetable";
import {WeeklyScheduleBrowser} from "../../src/components/weekly-schedule";
import {AdminDashboard} from "../../src/components/admin-dashboard";
import {BotanicalLines} from "../../src/components/brand";
import {BookCover} from "../../src/components/book-cover";
import {HeaderAvatar} from "../../src/components/header-avatar";
import {PageIntro} from "../../src/components/ui";
import {ActionForm} from "../../src/components/action-form";
import {TicketFields} from "../../src/components/ticket-fields";
import {TicketConversation} from "../../src/components/ticket-conversation";
import {ScheduleDiff} from "../../src/components/schedule-diff";
import {FullLoadIntro} from "../../src/components/full-load-intro";
import {LibraryBrowser} from "../../src/components/library-browser";
import {initialLibraryFilters} from "../../src/lib/library";
import {parseLocale} from "../../src/lib/i18n";
import {v05Copy} from "../../src/lib/v05-copy";
import {classes,subjects,books} from "./fixtures";
import type {SupportTicket,SupportMessage,SupportStatusEvent,WeeklyLesson} from "../../src/lib/database.types";
const lessons:WeeklyLesson[]=Array.from({length:5},(_,i)=>({id:"row"+i,class_id:classes[0].id,weekday:i+1,lesson_start:1,lesson_end:2,start_time:"08:30",end_time:"10:10",subject_id:subjects[i%2].id,teacher:"Hidden teacher",room:"каб. 305",effective_from:null,effective_to:null,created_at:"",updated_at:""}));
const days=[{start_date:"2026-09-21",end_date:"2026-09-25",type:"vacation" as const,label:"Autumn break"}];
type Conversation={ticket:SupportTicket;messages:SupportMessage[];events:SupportStatusEvent[]};
function Harness(){
 const [locale,setLocale]=useState(parseLocale(new URLSearchParams(location.search).get("locale")??"en"));
 const [admin,setAdmin]=useState(false),[conversation,setConversation]=useState<Conversation|null>(null);
 const t=v05Copy(locale),date=new URLSearchParams(location.search).get("today")??"2026-09-18";
 const path=location.pathname;
 async function action(kind:string,form:FormData){
  const response=await fetch("/fixture/ticket",{method:"POST",body:JSON.stringify({kind,admin,...Object.fromEntries(form)})});
  const body=await response.json();if(!response.ok)return {error:t.error};
  setConversation(body);return {success:t.saved};
 }
 return <LocaleProvider locale={locale}><FullLoadIntro/><AppFrame admin preferences={<PreferenceControls localeAction={async value=>{const selected=parseLocale(value);setLocale(selected);document.documentElement.lang=selected;return {ok:true};}}/>}
 avatar={<HeaderAvatar url={null} name="Amina"/>} account={<span className="text-xs">Fixture</span>}>
 {path==="/library"?<LibraryBrowser books={books} subjects={subjects} classes={classes} initial={initialLibraryFilters(Object.fromEntries(new URLSearchParams(location.search)))} truncated={false}/>:
 path==="/admin"?<AdminDashboard locale={locale} open={2} unread={1} recent={[{id:"version1",created_at:"2026-09-14T08:00:00Z",row_count:5,source_type:"csv_tsv"}]}/>:
 path==="/support"?<><label className="flex gap-3 mb-6"><input type="checkbox" checked={admin} onChange={event=>setAdmin(event.target.checked)}/>Fixture admin session</label>
 {conversation?<TicketConversation {...conversation} locale={locale} admin={admin} replyAction={(_,form)=>action("reply",form)} statusAction={(_,form)=>action("status",form)}/>:
 <ActionForm action={(_,form)=>action("create",form)} label={t.send}><TicketFields locale={locale}/></ActionForm>}</>:
 path==="/schedule"?<WeeklyScheduleBrowser lessons={lessons} subjects={subjects} classes={classes} initialClassId={classes[0].id} date={date} nonSchoolDays={days}/>:
 path==="/versions"?<ScheduleDiff before={lessons} after={lessons.map(row=>({...row,room:"307"}))} subjects={subjects} classes={classes} locale={locale}/>:
 <><div className="home-greeting"><BotanicalLines className="greeting-botanical"/><PageIntro title={t.greeting+", Amina"} kicker={classes[0].name}>{t.tagline}</PageIntro></div><div className="home-panels mt-10 grid gap-6 xl:grid-cols-[1.15fr_1fr]">
 <div className="surface-card home-panel"><HomeTimetable grade={classes[0].grade} lessons={lessons} subjects={subjects} classId={classes[0].id} today={date} nonSchoolDays={days}/></div>
 <section className="surface-card home-panel"><h2 className="section-title">Continue reading</h2><div className="reading-item mt-5"><BookCover title="Mathematics · 7" url={null}/><div><h3 className="font-semibold">Mathematics · 7</h3><p>Page 12</p></div></div></section></div></>}
 </AppFrame></LocaleProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
