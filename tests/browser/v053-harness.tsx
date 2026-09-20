// Test-only component harness; not included in production routes.
import { createRoot } from "react-dom/client";
import { useState,useEffect } from "react";
import { LocaleProvider } from "../../src/components/locale-provider";
import { AppFrame } from "../../src/components/app-frame";
import { PreferenceControls } from "../../src/components/preference-controls";
import { LibraryBrowser } from "../../src/components/library-browser";
import { WeeklyScheduleBrowser } from "../../src/components/weekly-schedule";
import { HomeTimetable } from "../../src/components/home-timetable";
import { TopSubjects } from "../../src/components/top-subjects";
import { PeopleBrowser } from "../../src/components/people-browser";
import { PublicProfile } from "../../src/components/public-profile";

import { CommunityNav } from "../../src/components/community-nav";
import { MessagesPanel } from "../../src/components/messages-panel";
import { NotificationCenter } from "../../src/components/notification-center";
import { ClassHomeworkPanel } from "../../src/components/class-homework";
import { StudyAnswerForm } from "../../src/components/study-answer-form";
import { LegalContent } from "../../src/components/legal-content";
import { findPeople } from "../../src/app/actions/people";
import type { Person } from "../../src/lib/people";
import { parseLocale } from "../../src/lib/i18n";
import { initialLibraryFilters } from "../../src/lib/library";
import { books,classes,subjects,fixtureClass as id } from "./fixtures";
const lessons=[1,2,3,4,5].map(day=>({id:id(500+day),class_id:classes[0].id,weekday:day,lesson_start:1,lesson_end:2,start_time:"08:30",end_time:"10:00",subject_id:subjects[0].id,teacher:"NEVER_VISIBLE_TEACHER",room:"135",effective_from:null,effective_to:null,created_at:"",updated_at:""}));
function Profile({locale}:{locale:"ru"|"kk"|"en"}){
 const [person,setPerson]=useState<Person|null>(null);
 useEffect(()=>{void findPeople("profile","",id(2)).then(r=>{if("data"in r)setPerson(r.data[0]??null);});},[]);
 return person?<PublicProfile person={person} subjects={subjects} locale={locale} thread={new URLSearchParams(location.search).get("thread")??undefined}/>:<p>No profile</p>;
}
function Harness(){
 const [locale,setLocale]=useState(parseLocale(new URLSearchParams(location.search).get("locale")??"en")),path=location.pathname;
 return <LocaleProvider locale={locale}><AppFrame admin preferences={<PreferenceControls localeAction={async value=>{const l=parseLocale(value);setLocale(l);document.documentElement.lang=l;return {ok:true};}}/>} account={null} avatar={<NotificationCenter/>}>
 <h1 className="page-title">NIS Hub — v0.5.3</h1><CommunityNav locale={locale}/>
 {path==="/library"?<LibraryBrowser books={books.map(b=>({...b,title:b.title+" ОченьДлинноеНазваниеБезПробелов".repeat(2)}))} classes={classes} subjects={subjects} initial={initialLibraryFilters(Object.fromEntries(new URLSearchParams(location.search)))} truncated={false}/>:
 path==="/schedule"?<><HomeTimetable lessons={lessons} subjects={subjects} classId={classes[0].id} today="2026-09-18" nonSchoolDays={[]} grade={7}/><WeeklyScheduleBrowser lessons={lessons} subjects={subjects} classes={classes} initialClassId={classes[0].id} date="2026-09-18"/><ClassHomeworkPanel userId={id(1)} hasClass date="2026-09-19" subjects={subjects}/></>:
 path==="/people"?<PeopleBrowser subjects={subjects}/>:
 path.startsWith("/people/")?<Profile locale={locale}/>:
 path==="/messages"?<MessagesPanel userId={id(1)} initialThread={new URLSearchParams(location.search).get("thread")??undefined}/>:
 path==="/reader"?<section className="surface-card"><StudyAnswerForm generationId={id(30)} response={{insufficient:false,sections:[{kind:"questions",insufficient:false,points:[{text:"What absorbs light?",evidence:[{page:1,quote:"Chlorophyll absorbs light."}]}]}]}}/></section>:
 path==="/privacy"||path==="/terms"?<LegalContent kind={path==="/privacy"?"privacy":"terms"} locale={locale}/>:
 <section className="surface-card"><TopSubjects subjects={subjects} initial={subjects.map(s=>s.id)}/></section>}
 </AppFrame></LocaleProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
