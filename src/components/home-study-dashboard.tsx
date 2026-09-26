"use client";
import {useState, type ReactNode} from "react";
import type {PersonalTask,SubjectRow,WeeklyLesson} from "@/lib/database.types";
import {type CalendarDay,dayReasons} from "@/lib/school-calendar";
import {schoolWeek,weeklyDay} from "@/lib/weekly-schedule";
import {defaultLesson} from "@/lib/study-dashboard";
import type {MaterialMap} from "@/lib/schedule-materials";
import {useI18n} from "./locale-provider";
import {HomeTimetable} from "./home-timetable";
import {SelectedLesson} from "./selected-lesson";
import {HomeworkPreview} from "./homework-preview";
import {SectionLink} from "./ui";
import {TaskCenter} from "./task-center";

export function HomeStudyDashboard({lessons,subjects,tasks=[],classId,today,nonSchoolDays,grade,materials,time,reading,activity}:{
  lessons:WeeklyLesson[]; subjects:SubjectRow[]; tasks?:PersonalTask[]; classId:string; today:string; nonSchoolDays:CalendarDay[];
  grade:number|null; materials:MaterialMap; time:string; reading:ReactNode; activity:ReactNode;
}) {
  const {locale,t}=useI18n();
  const [date,setDate]=useState(today),[selection,setSelection]=useState<{date:string;id:string}|null>(null);
  const rows=dayReasons(date,nonSchoolDays,locale).length?[]:weeklyDay(lessons,classId,schoolWeek(date).weekday,date);
  const selected=rows.find(row=>selection?.date===date&&selection.id===row.id)??defaultLesson(rows,date,today,time);
  return <div className="home-study-dashboard">
    <div className="dashboard-primary">
      <SelectedLesson lesson={selected} subjects={subjects} date={date} grade={grade} materials={materials}/>
      <section className="surface-card dashboard-timetable">
        <HomeTimetable lessons={lessons} subjects={subjects} classId={classId} today={today} nonSchoolDays={nonSchoolDays} grade={grade} materials={materials}
          selectedDate={date} onDateChange={setDate} selectedId={selected?.id} onLessonSelect={id=>setSelection({date,id})}/>
        <SectionLink href="/schedule">{t.allSchedule}</SectionLink>
      </section>
    </div>
    <div className="dashboard-secondary">
      <TaskCenter initialTasks={tasks} subjects={subjects} variant="compact"/>
      <HomeworkPreview date={date} subjects={subjects} hasClass={!!classId}/>
      {activity}
      <section className="surface-card"><h2 className="section-title">{t.continueReading}</h2>{reading}<SectionLink href="/library">{t.openLibrary}</SectionLink></section>
    </div>
  </div>;
}
