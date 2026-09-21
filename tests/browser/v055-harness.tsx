// Isolated UI QA only. All SMS responses below are synthetic; never production data.
import {createRoot} from "react-dom/client";
import {useState} from "react";
import {AppFrame} from "../../src/components/app-frame";
import {LocaleProvider} from "../../src/components/locale-provider";
import {PreferenceControls} from "../../src/components/preference-controls";
import {SmsDiary} from "../../src/components/sms-diary";
import {LibraryBrowser} from "../../src/components/library-browser";
import {LegalContent} from "../../src/components/legal-content";
import {HomeTimetable} from "../../src/components/home-timetable";
import {StudyRoutes} from "../../src/components/study-routes";
import {WeeklyLessonList} from "../../src/components/weekly-schedule";
import {parseLocale} from "../../src/lib/i18n";
import {HIDDEN_BOOK_TITLE,initialLibraryFilters} from "../../src/lib/library";
import type {SubjectRow,WeeklyLesson} from "../../src/lib/database.types";
const scheduleSubjects:SubjectRow[]=[{id:"00000000-0000-4000-8000-000000000020",name:"Математика",name_kz:"Математика",name_en:"Mathematics",short_name:null,created_at:""},{id:"00000000-0000-4000-8000-000000000021",name:"Физика",name_kz:"Физика",name_en:"Physics",short_name:null,created_at:""}];
const scheduleLessons:WeeklyLesson[]=[{id:"lesson-1",class_id:"00000000-0000-4000-8000-000000000010",weekday:1,lesson_start:1,lesson_end:2,start_time:"08:30",end_time:"10:10",subject_id:scheduleSubjects[0].id,teacher:null,room:"305",effective_from:"2026-09-01",effective_to:null,created_at:"",updated_at:""},{id:"lesson-2",class_id:"00000000-0000-4000-8000-000000000010",weekday:1,lesson_start:3,lesson_end:4,start_time:"10:15",end_time:"11:45",subject_id:scheduleSubjects[1].id,teacher:null,room:"248",effective_from:"2026-09-01",effective_to:null,created_at:"",updated_at:""}];
function Harness(){
 const params=new URLSearchParams(location.search);
 const [locale,setLocale]=useState(parseLocale(params.get("locale")||"en"));
 return <LocaleProvider locale={locale}><AppFrame preferences={<PreferenceControls localeAction={async value=>{setLocale(parseLocale(value));return {ok:true};}}/>} account={null} avatar={null}>
 <h1>SMS Diary QA</h1>
 {location.pathname==="/home-motion"?<><HomeTimetable lessons={scheduleLessons} subjects={scheduleSubjects} classId={scheduleLessons[0].class_id} today="2026-09-21" nonSchoolDays={[]}/><StudyRoutes/></>:
 location.pathname==="/schedule"||location.pathname==="/home-schedule"?<section aria-label={location.pathname==="/schedule"?"Schedule":"Home schedule"}><WeeklyLessonList grade={10} lessons={scheduleLessons} subjects={scheduleSubjects}/></section>:
 location.pathname==="/library"?<LibraryBrowser books={[{id:"normal",title:"Physics",grade:9,subject_id:"physics"},{id:"egg",title:HIDDEN_BOOK_TITLE,grade:11,subject_id:"literature"}]} classes={[]} subjects={[]} initial={initialLibraryFilters(Object.fromEntries(params))} truncated={false}/>:
 location.pathname==="/privacy"?<LegalContent kind="privacy" locale={locale}/>:
 <SmsDiary enabled={params.get("mode")!=="disabled"} sessionPresent={params.get("connected")==="1"}/>}
 </AppFrame></LocaleProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
