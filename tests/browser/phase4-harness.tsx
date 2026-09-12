// Test-only boundaries. Production components, synthetic Auth/Storage transport.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { LocaleProvider } from "../../src/components/locale-provider";
import { PreferenceControls } from "../../src/components/preference-controls";
import { WeeklyScheduleBrowser } from "../../src/components/weekly-schedule";
import { WeeklyImport } from "../../src/components/weekly-import";
import { BookEditor } from "../../src/components/book-editor";
import { PdfReader } from "../../src/components/pdf-reader";
import { classes, subjects } from "./fixtures";
import { parseLocale } from "../../src/lib/i18n";
import { parseTimetable } from "../../src/lib/timetable-import";
import type { WeeklyLesson } from "../../src/lib/database.types";
const id = "00000000-0000-4000-8000-000000000030";
const csv = "class,weekday,lesson_start,lesson_end,start_time,end_time,subject,teacher,room\n"+
  classes[0].name+",Mon,1,2,08:30,10:10,"+subjects[0].name+",Teacher,305\n"+
  classes[0].name+",Tue,3,4,10:15,11:45,"+subjects[1].name+",Other teacher,231";
const lessons: WeeklyLesson[] = parseTimetable(csv,classes,subjects).lessons.map((row,i)=>({...row,id:String(i),created_at:"",updated_at:""}));
function Harness() {
  const [locale,setLocale] = useState<"ru"|"kk"|"en">("en");
  const [message,setMessage] = useState("");
  const initial = (window as unknown as {fixtureReading:{page:number;bookmarks:number[]}}).fixtureReading;
  return <LocaleProvider locale={locale}><main className="mx-auto max-w-5xl p-4">
    <h1 className="page-title">Phase 4 component verification</h1>
    <PreferenceControls localeAction={async value=>{ const selected=parseLocale(value); setLocale(selected); document.documentElement.lang=selected;return {ok:true}; }}/>
    {location.pathname==="/weekly" ? <><WeeklyScheduleBrowser lessons={lessons} classes={classes} subjects={subjects} initialClassId={classes[0].id} date="2026-09-07"/>
      <WeeklyImport classes={classes} subjects={subjects} lessons={lessons} action={async(_s,form)=>{
        const response=await fetch("/fixture/import",{method:"POST",body:String(form.get("timetable"))});const result=await response.json();setMessage(result.success||result.error);return result;
      }}/></> : location.pathname==="/reader" ? <PdfReader bookId={id} initialPage={initial.page} initialBookmarks={initial.bookmarks}/>
      : <BookEditor id={id} classes={classes} subjects={subjects} action={async(form,stage)=>{
        const response=await fetch("/fixture/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({stage,...Object.fromEntries(form)})});return response.json();
      }}/>}
    <output>{message}</output>
  </main></LocaleProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
