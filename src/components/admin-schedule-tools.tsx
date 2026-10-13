import {requireAdmin} from "@/lib/auth";
import {getCatalogOptions} from "@/lib/queries";
import {getWeeklySchedule} from "@/lib/weekly-queries";
import {getNonSchoolDays} from "@/lib/calendar-queries";
import {getEduPageStatus} from "@/lib/edupage/state";
import {schoolDate,uuid} from "@/lib/validation";
import {getI18n} from "@/lib/i18n-server";
import {phase4Copy} from "@/lib/phase4-copy";
import {subjectName} from "@/lib/i18n";
import {importWeeklySchedule} from "@/app/actions/weekly-import";
import {EduPageSync} from "./edupage-sync";
import {WeeklyScheduleBrowser} from "./weekly-schedule";
import {WeeklyImport} from "./weekly-import";
import {AdminLessonRemoval} from "./admin-lesson-removal";
import {AssessmentImport} from "./assessment-import";
import {getAssessmentSchedule,getAssessmentPeriods} from "@/lib/assessment-queries";
import {assessmentOverlays} from "@/lib/assessment-schedule";
export async function AdminWeeklySchedule({id}:{id?:string}){
 await requireAdmin();const [{classes,subjects},lessons,days,{locale}]=await Promise.all([getCatalogOptions(),getWeeklySchedule(),getNonSchoolDays(),getI18n()]);
 const chosen=uuid.safeParse(id).success?lessons.find(l=>l.id===id):undefined,p=phase4Copy(locale),subjectMap=new Map(subjects.map(s=>[s.id,s]));
 const exams=await getAssessmentSchedule();
 return <><WeeklyScheduleBrowser lessons={[...lessons,...assessmentOverlays(exams.rows,lessons)]} classes={classes} subjects={subjects} initialClassId={chosen?.class_id??classes[0]?.id??""} date={schoolDate()} nonSchoolDays={days}/>
  <AdminLessonRemoval classes={classes} initialClass={chosen?.class_id??classes[0]?.id??""} entries={lessons.map(l=>({id:l.id,class_id:l.class_id,label:p.shortDays[l.weekday-1]+" · "+l.lesson_start+"–"+l.lesson_end+" · "+subjectName(subjectMap.get(l.subject_id),locale)+(l.subgroup_label?" · "+l.subgroup_label:"")}))}/>
 </>;
}
export async function AdminScheduleImport(){await requireAdmin();const [options,lessons,exams,periods]=await Promise.all([getCatalogOptions(),getWeeklySchedule(),getAssessmentSchedule(),getAssessmentPeriods()]);return <><AssessmentImport classes={options.classes} dates={[...new Set(exams.rows.map(row=>row.date))].sort()} periods={periods.rows} available={exams.available&&periods.available}/><WeeklyImport {...options} lessons={lessons} action={importWeeklySchedule}/></>;}
export async function AdminEduPage(){await requireAdmin();const [initial,options]=await Promise.all([getEduPageStatus(),getCatalogOptions()]);return <EduPageSync initial={initial} {...options}/>;}
