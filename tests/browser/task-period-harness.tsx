import {createRoot} from "react-dom/client";
import {LocaleProvider} from "../../src/components/locale-provider";
import {TaskCenter} from "../../src/components/task-center";
import {LegalContent} from "../../src/components/legal-content";
import type {PersonalTask} from "../../src/lib/database.types";
const fixture=(title:string,due:string|null,status:PersonalTask["status"]="active"):PersonalTask=>({id:title,owner_id:"fixture",subject_id:null,title,notes:"",priority:"medium",status,due_at:due,remind_at:null,reminder_read_at:null,completed_at:null,created_at:"2026-10-01T00:00:00Z",updated_at:"2026-10-01T00:00:00Z"});
const tasks=[fixture("Start boundary","2026-09-30T00:00:00Z"),fixture("End boundary","2026-10-03T23:59:00Z"),fixture("Outside range","2026-10-04T00:00:00Z"),fixture("Today task","2026-10-13T15:00:00Z"),fixture("Completed today","2026-10-13T16:00:00Z","completed"),fixture("Undated task",null)];
const locale=new URLSearchParams(location.search).get("locale")==="kk"?"kk":new URLSearchParams(location.search).get("locale")==="en"?"en":"ru";
createRoot(document.getElementById("root")!).render(<LocaleProvider locale={locale}><main style={{maxWidth:1000,padding:24,margin:"auto"}}>{location.pathname==="/privacy"?<LegalContent kind="privacy" locale={locale}/>:<TaskCenter initialTasks={tasks} subjects={[]}/>}</main></LocaleProvider>);
