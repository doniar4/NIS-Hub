"use client";

import {useId,useMemo,useState,type ReactNode} from "react";
import type {ClassRow,SubjectRow,WeeklyLesson} from "@/lib/database.types";
import {eduPageCopy} from "@/lib/edupage/copy";
import {materialKey,type MaterialMap} from "@/lib/schedule-materials";
import {classGrade,librarySubjectHref} from "@/lib/book-model";
import {type CalendarDay,dayReasons,formatSchoolDate} from "@/lib/school-calendar";
import {v05Copy} from "@/lib/v05-copy";
import {normalizeRoom,subjectMap,sortClasses} from "@/lib/catalog";
import {phase4Copy} from "@/lib/phase4-copy";
import {subjectName} from "@/lib/i18n";
import {weeklyDay,lessonRange,schoolWeek} from "@/lib/weekly-schedule";
import {useI18n} from "./locale-provider";
import {LessonActions} from "./lesson-actions";
import {EmptyState} from "./ui";
import {SubjectMotif} from "./subject-motif";
import {SelectedLesson} from "./selected-lesson";

export function WeeklyLessonList({lessons,subjects,grade=null,materials={},date,canAddHomework=false,selectedId,onSelect}:{
  lessons:WeeklyLesson[]; subjects:SubjectRow[]; grade?:number|null; materials?:MaterialMap; date?:string; canAddHomework?:boolean;
  selectedId?:string; onSelect?:(id:string)=>void;
}) {
  const {locale,t}=useI18n(),subjectsById=useMemo(()=>subjectMap(subjects),[subjects]);
  return <>
    {lessons.some(row=>row.subgroup_label)&&<p className="my-3 text-sm text-[var(--muted)]">{eduPageCopy(locale).groupHint}</p>}
    <ol className="lesson-list">{lessons.map(row=>{
      const content=<><SubjectMotif subject={subjectsById.get(row.subject_id)}/>
        <span className="lesson-clock">{row.start_time&&row.end_time&&<span className="lesson-time">{row.start_time.slice(0,5)}–{row.end_time.slice(0,5)}</span>}<span className="lesson-slot">{t.lesson} {lessonRange(row)}</span></span>
        <span className="lesson-info"><strong>{subjectName(subjectsById.get(row.subject_id),locale)}</strong>
          {row.subgroup_label&&<span className="lesson-room">{eduPageCopy(locale).subgroup}: {row.subgroup_label}</span>}
          {row.room&&<span className="lesson-room">{t.room}: {normalizeRoom(row.room)}</span>}
        </span></>;
      return <li key={row.id} className={"timetable-row lesson-row"+(selectedId===row.id?" is-selected":"")}>
        {onSelect?<button type="button" className="lesson-select" aria-pressed={selectedId===row.id} onClick={()=>onSelect(row.id)}>{content}</button>:<div className="lesson-select lesson-static">{content}</div>}
        <LessonActions key={row.id+(date??"")} subjectId={row.subject_id} subject={subjectName(subjectsById.get(row.subject_id),locale)}
          href={materials[materialKey(row.subject_id,grade)]??librarySubjectHref(row.subject_id,grade)} date={date} canAddHomework={canAddHomework}/>
      </li>;
    })}</ol>
  </>;
}

export function WeeklyScheduleBrowser({lessons,classes,subjects,initialClassId,date,nonSchoolDays=[],materials={},homeworkPreview,homeworkEditor}:{
  lessons:WeeklyLesson[]; classes:ClassRow[]; subjects:SubjectRow[]; initialClassId:string; date:string;
  nonSchoolDays?:CalendarDay[]; materials?:MaterialMap; homeworkPreview?:(date:string)=>ReactNode; homeworkEditor?:(date:string)=>ReactNode;
}) {
  const {locale,t}=useI18n(),p=phase4Copy(locale),week=schoolWeek(date),id=useId();
  const [classId,setClassId]=useState(initialClassId),[weekday,setWeekday]=useState(week.weekday>=1&&week.weekday<=5?week.weekday:1);
  const [selectedId,setSelectedId]=useState("");
  const selectedDate=week.dates[weekday-1],reasons=dayReasons(selectedDate,nonSchoolDays,locale);
  const filtered=useMemo(()=>weeklyDay(lessons,classId,weekday,schoolWeek(date).dates[weekday-1]),[lessons,classId,weekday,date]);
  const grade=classGrade(classes.find(c=>c.id===classId));
  const selected=filtered.find(row=>row.id===selectedId)??filtered[0];
  return <section className="schedule-browser mt-8">
    <div className="schedule-controls surface-card">
      <label className="block"><span className="field-label">{t.class}</span><select className="field" value={classId} onChange={e=>setClassId(e.target.value)}>
        <option value="">{t.notSelected}</option>{sortClasses(classes).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>
      <div className="schedule-day-deck"><div role="tablist" aria-label={p.weeklyTitle} className="day-deck-grid" onKeyDown={e=>{
        const next=e.key==="ArrowRight"?(weekday%5)+1:e.key==="ArrowLeft"?((weekday+3)%5)+1:e.key==="Home"?1:e.key==="End"?5:null;
        if(next){e.preventDefault();setWeekday(next);e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next-1]?.focus();}
      }}>{p.weekdays.map((label,index)=><button key={index} type="button" role="tab" id={id+"-day-"+(index+1)} aria-controls={id+"-panel"} aria-selected={weekday===index+1} tabIndex={weekday===index+1?0:-1}
        aria-label={label} className={"day-square-btn"+(weekday===index+1?" is-active":"")} onClick={()=>setWeekday(index+1)}>
        <span className="day-square-code">{p.shortDays[index]}</span><span className="day-square-label">{label}</span>
      </button>)}</div></div>
    </div>
    <section role="tabpanel" id={id+"-panel"} aria-labelledby={id+"-day-"+weekday} tabIndex={0} className="schedule-day-content">
      <div className="surface-card schedule-lessons"><h2 className="section-title"><time dateTime={selectedDate}>{formatSchoolDate(selectedDate,locale)}</time></h2>
        <p className="sr-only" role="status">{p.weekdays[weekday-1]}: {reasons.length?0:filtered.length}</p>
        {reasons.length?<div className="calendar-notice"><h3>{v05Copy(locale).offDay}</h3><ul>{reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></div>:filtered.length?
          <WeeklyLessonList lessons={filtered} subjects={subjects} date={selectedDate} canAddHomework={!!initialClassId&&classId===initialClassId} materials={materials} grade={grade}
            selectedId={selected?.id} onSelect={setSelectedId}/>:
          <div className="mt-5"><EmptyState title={classId?t.noLessons:t.chooseClass}>{classId?t.noLessonsHint:t.chooseClassHint}</EmptyState></div>}
      </div>
      <div className="schedule-inspector"><SelectedLesson lesson={reasons.length?undefined:selected} subjects={subjects} date={selectedDate} grade={grade} materials={materials}/>
        {classId===initialClassId&&homeworkPreview?.(selectedDate)}
      </div>
    </section>
    {homeworkEditor?.(selectedDate)}
  </section>;
}
