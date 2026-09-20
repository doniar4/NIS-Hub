"use client";

import { materialKey,type MaterialMap } from "@/lib/schedule-materials";
import { v053Copy } from "@/lib/v053-copy";
import { classGrade, librarySubjectHref } from "@/lib/book-model";

import { SubjectMotif } from "./subject-motif";

import Link from "next/link";

import { type CalendarDay, dayReasons } from "@/lib/school-calendar";

import { v05Copy } from "@/lib/v05-copy";

import { normalizeRoom, subjectMap, sortClasses } from "@/lib/catalog";

import { useMemo, useState } from "react";

import type {
  ClassRow,
  SubjectRow,
  WeeklyLesson,
} from "@/lib/database.types";

import { useI18n } from "./locale-provider";

import { phase4Copy } from "@/lib/phase4-copy";

import { subjectName } from "@/lib/i18n";

import {
  weeklyDay,
  lessonRange,
  schoolWeek,
} from "@/lib/weekly-schedule";

import { EmptyState } from "./ui";

export function WeeklyLessonList({
  lessons,
  subjects,
  grade = null,
  materials = {},
}: {
  lessons: WeeklyLesson[];
  subjects: SubjectRow[];
  grade?: number | null;
  materials?: MaterialMap;
}) {
  const { locale, t } = useI18n();

  const subjectsById = useMemo(
    () => subjectMap(subjects),
    [subjects],
  );

  return (
    <ol className="divide-y divide-[var(--line)]">
      {lessons.map((row) => (
        <li
          key={row.id}
          className="timetable-row flex items-center justify-between gap-4 py-4 px-3"
        >
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-lg font-semibold">
              <Link
                prefetch={false}
                href={librarySubjectHref(
                  row.subject_id,
                  grade,
                )}
                className="timetable-subject-link inline-flex min-h-11 items-center"
              >
                {subjectName(
                  subjectsById.get(row.subject_id),
                  locale,
                )}
              </Link>
            </h3>

            {row.start_time && row.end_time && (
              <p className="lesson-time mt-1 text-lg font-semibold tabular-nums">
                {row.start_time.slice(0, 5)}–
                {row.end_time.slice(0, 5)}
              </p>
            )}

            <p className="lesson-slot mt-2 text-sm text-[var(--muted)]">
              {t.lesson} {lessonRange(row)}
            </p>

            {row.room && (
              <p className="lesson-room mt-1 text-sm">
                {t.room}: {normalizeRoom(row.room)}
              </p>
            )}
          </div>

          <Link prefetch={false} className="button button-secondary timetable-materials" href={materials[materialKey(row.subject_id,grade)]??librarySubjectHref(row.subject_id,grade)} aria-label={v053Copy(locale).materials+": "+subjectName(subjectsById.get(row.subject_id),locale)}>{v053Copy(locale).materials}</Link>
          <SubjectMotif
            subject={subjectsById.get(row.subject_id)}
          />
        </li>
      ))}
    </ol>
  );
}

export function WeeklyScheduleBrowser({
  lessons,
  classes,
  subjects,
  initialClassId,
  date,
  nonSchoolDays = [],
  materials = {},
}: {
  lessons: WeeklyLesson[];
  classes: ClassRow[];
  subjects: SubjectRow[];
  initialClassId: string;
  date: string;
  nonSchoolDays?: CalendarDay[];
  materials?: MaterialMap;
}) {
  const { locale, t } = useI18n();
  const p = phase4Copy(locale);
  const week = schoolWeek(date);

  const [classId, setClassId] = useState(initialClassId);

  const [weekday, setWeekday] = useState(
    week.weekday >= 1 && week.weekday <= 5
      ? week.weekday
      : 1,
  );

  const selectedDate = week.dates[weekday - 1];

  const reasons = dayReasons(
    selectedDate,
    nonSchoolDays,
    locale,
  );

  const filtered = useMemo(
    () =>
      weeklyDay(
        lessons,
        classId,
        weekday,
        schoolWeek(date).dates[weekday - 1],
      ),
    [lessons, classId, weekday, date],
  );

  return (
    <section className="schedule-browser surface-card mt-8">
      <label className="block max-w-xs">
        <span className="field-label">{t.class}</span>

        <select
          className="field"
          value={classId}
          onChange={(event) =>
            setClassId(event.target.value)
          }
        >
          <option value="">{t.notSelected}</option>

          {sortClasses(classes).map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>

      <div className="schedule-day-deck">
        <div
          role="tablist"
          aria-label={p.weeklyTitle}
          className="day-deck-grid"
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (weekday % 5) + 1
                : event.key === "ArrowLeft"
                  ? ((weekday + 3) % 5) + 1
                  : event.key === "Home"
                    ? 1
                    : event.key === "End"
                      ? 5
                      : null;

            if (next) {
              event.preventDefault();
              setWeekday(next);
              event.currentTarget
                .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [next - 1]?.focus();
            }
          }}
        >
          {p.weekdays.map((label, index) => {
            const isSelected = weekday === index + 1;
            const shortName = p.shortDays[index];

            return (
              <button
                key={index}
                type="button"
                role="tab"
                id={"day-" + (index + 1)}
                aria-controls="weekly-panel"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                aria-label={label}
                className={`day-square-btn ${isSelected ? "is-active" : ""}`}
                onClick={() => setWeekday(index + 1)}
              >
                <span className="day-square-code">{shortName}</span>
                <span className="day-square-label">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section
        role="tabpanel"
        id="weekly-panel"
        aria-labelledby={"day-" + weekday}
        tabIndex={0}
      >
        <h2 className="section-title">
          {p.weekdays[weekday - 1]} · {selectedDate}
        </h2>

        <p className="sr-only" role="status">
          {p.weekdays[weekday - 1]}:{" "}
          {reasons.length ? 0 : filtered.length}
        </p>

        {reasons.length ? (
          <div className="calendar-notice">
            <h3>{v05Copy(locale).offDay}</h3>

            <ul>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : filtered.length ? (
          <WeeklyLessonList
            lessons={filtered}
            materials={materials}
            subjects={subjects}
            grade={classGrade(
              classes.find((c) => c.id === classId),
            )}
          />
        ) : (
          <div className="mt-5">
            <EmptyState
              title={
                classId ? t.noLessons : t.chooseClass
              }
            >
              {classId
                ? t.noLessonsHint
                : t.chooseClassHint}
            </EmptyState>
          </div>
        )}
      </section>
    </section>
  );
}
