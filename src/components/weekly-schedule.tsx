"use client";
import {SubjectMotif} from "./subject-motif";
import Link from "next/link";
import { type CalendarDay, dayReasons } from "@/lib/school-calendar";
import { v05Copy } from "@/lib/v05-copy";
import { normalizeRoom, subjectMap, sortClasses } from "@/lib/catalog";
import { useMemo, useState } from "react";
import type { ClassRow, SubjectRow, WeeklyLesson } from "@/lib/database.types";
import { useI18n } from "./locale-provider";
import { phase4Copy } from "@/lib/phase4-copy";
import { subjectName } from "@/lib/i18n";
import { weeklyDay, lessonRange, schoolWeek } from "@/lib/weekly-schedule";
import { EmptyState } from "./ui";
export function WeeklyLessonList({ lessons, subjects }: { lessons: WeeklyLesson[]; subjects: SubjectRow[] }) {
  const { locale, t } = useI18n();
  const subjectsById = useMemo(() => subjectMap(subjects), [subjects]);
  return <ol className="divide-y divide-[var(--line)]">{lessons.map(row => <li key={row.id} className="timetable-row flex items-start gap-4 py-5">
    <SubjectMotif subject={subjectsById.get(row.subject_id)}/>
    <span className="min-w-10 font-semibold" aria-label={t.lesson + " " + lessonRange(row)}>{lessonRange(row)}</span>
    <div className="min-w-0 flex-1"><h3 className="break-words font-semibold"><Link prefetch={false}
        href={{ pathname: "/library", query: { subject: row.subject_id, classId: row.class_id } }}
        className="timetable-subject-link inline-flex min-h-11 items-center">
        {subjectName(subjectsById.get(row.subject_id),locale)}
      </Link></h3>
      {row.start_time && row.end_time && <p className="mt-1 text-sm">{row.start_time.slice(0,5)}–{row.end_time.slice(0,5)}</p>}
      {row.room && <p className="mt-1 text-sm">{t.room}: {normalizeRoom(row.room)}</p>}
    </div>
  </li>)}</ol>;
}
export function WeeklyScheduleBrowser({ lessons, classes, subjects, initialClassId, date, nonSchoolDays = [] }: { lessons: WeeklyLesson[]; classes: ClassRow[]; subjects: SubjectRow[]; initialClassId: string; date: string; nonSchoolDays?: CalendarDay[] }) {
  const { locale, t } = useI18n(); const p = phase4Copy(locale); const week = schoolWeek(date);
  const [classId,setClassId] = useState(initialClassId);
  const [weekday,setWeekday] = useState(week.weekday >= 1 && week.weekday <= 5 ? week.weekday : 1);
  const selectedDate = week.dates[weekday - 1];
  const reasons = dayReasons(selectedDate,nonSchoolDays,locale);
  const filtered = useMemo(() => weeklyDay(lessons,classId,weekday,schoolWeek(date).dates[weekday-1]), [lessons,classId,weekday,date]);
  return <section className="schedule-browser surface-card mt-8">
    <label className="block max-w-xs"><span className="field-label">{t.class}</span><select className="field" value={classId} onChange={event => setClassId(event.target.value)}>
      <option value="">{t.notSelected}</option>{sortClasses(classes).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
    </select></label>
    <div role="tablist" aria-label={p.weeklyTitle} className="my-6 grid grid-cols-5 gap-1 sm:gap-3" onKeyDown={event => {
      const next = event.key === "ArrowRight" ? weekday % 5 + 1 : event.key === "ArrowLeft" ? (weekday + 3) % 5 + 1 : event.key === "Home" ? 1 : event.key === "End" ? 5 : null;
      if (next) { event.preventDefault(); setWeekday(next); event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next-1]?.focus(); }
    }}>
      {p.weekdays.map((label,index) => <button key={index} type="button" role="tab" id={"day-"+(index+1)} aria-controls="weekly-panel"
        aria-selected={weekday===index+1} tabIndex={weekday===index+1 ? 0 : -1} aria-label={label}
        className={"button !px-1 " + (weekday===index+1 ? "" : "button-secondary")} onClick={() => setWeekday(index+1)}>{p.shortDays[index]}</button>)}
    </div>
    <section role="tabpanel" id="weekly-panel" aria-labelledby={"day-"+weekday} tabIndex={0}>
      <h2 className="section-title">{p.weekdays[weekday-1]} · {selectedDate}</h2>
      <p className="sr-only" role="status">{p.weekdays[weekday-1]}: {reasons.length ? 0 : filtered.length}</p>
      {reasons.length ? <div className="calendar-notice"><h3>{v05Copy(locale).offDay}</h3><ul>{reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></div> : filtered.length ? <WeeklyLessonList lessons={filtered} subjects={subjects}/> : <div className="mt-5"><EmptyState title={classId ? t.noLessons : t.chooseClass}>{classId ? t.noLessonsHint : t.chooseClassHint}</EmptyState></div>}
    </section>
  </section>;
}
