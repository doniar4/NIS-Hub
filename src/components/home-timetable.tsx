"use client";

import type { MaterialMap } from "@/lib/schedule-materials";
import { useState } from "react";

import type { SubjectRow, WeeklyLesson } from "@/lib/database.types";

import {
  type CalendarDay,
  dayReasons,
  formatSchoolDate,
  schoolDayJump,
} from "@/lib/school-calendar";

import { weeklyDay, schoolWeek } from "@/lib/weekly-schedule";

import { v05Copy } from "@/lib/v05-copy";

import { useI18n } from "./locale-provider";

import { WeeklyLessonList } from "./weekly-schedule";

import { PanelGlyph } from "./academic-art";

import { vintageCopy } from "@/lib/vintage-copy";

export function HomeTimetable({
  lessons,
  subjects,
  classId,
  today,
  nonSchoolDays,
  grade = null,
  materials = {},
}: {
  lessons: WeeklyLesson[];
  subjects: SubjectRow[];
  classId: string;
  today: string;
  nonSchoolDays: CalendarDay[];
  grade?: number | null;
  materials?: MaterialMap;
}) {
  const { locale, t } = useI18n();
  const p = v05Copy(locale);

  const [date, setDate] = useState(today);

  // Store intent, not translated text: a locale change re-renders every explanation.
  const [jump, setJump] = useState<{
    from: string;
    direction: -1 | 1;
  } | null>(null);

  const result = jump
    ? schoolDayJump(jump.from, jump.direction, nonSchoolDays, locale)
    : null;

  const reasons = dayReasons(date, nonSchoolDays, locale);

  const rows = reasons.length
    ? []
    : weeklyDay(lessons, classId, schoolWeek(date).weekday, date);

  const navigate = (direction: -1 | 1) => {
    const next = schoolDayJump(date, direction, nonSchoolDays, locale);

    setJump({
      from: date,
      direction,
    });

    if (next.date) {
      setDate(next.date);
    }
  };

  return (
    <section aria-label={t.today} className="home-timetable">
      <div className="timetable-heading">
        <div className="panel-heading">
          <PanelGlyph kind="schedule" />

          <div>
            <h2 className="section-title">
              {date === today ? p.today : p.preview}
            </h2>

            <p className="panel-caption">
              {date === today ? vintageCopy(locale).todayHint : t.schedule}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="button button-secondary"
            aria-label={p.previous}
            onClick={() => navigate(-1)}
          >
            ←
          </button>

          <button
            type="button"
            className="button button-secondary"
            aria-label={p.next}
            onClick={() => navigate(1)}
          >
            →
          </button>
        </div>
      </div>

      <p className="mt-2 font-medium">
        <time dateTime={date}>{formatSchoolDate(date, locale)}</time>
      </p>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="calendar-notice"
      >
        {result && !result.date && <p>{p.noNearby}</p>}

        {!!result?.skipped.length && (
          <>
            <p>{p.skipped}:</p>

            <ul>
              {result.skipped.map((gap, index) => (
                <li key={index}>
                  {formatSchoolDate(gap.start, locale)}
                  {gap.end !== gap.start &&
                    " — " + formatSchoolDate(gap.end, locale)}
                  {" · "}
                  {gap.reasons.join("; ")}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {date !== today && (
        <button
          type="button"
          className="button button-secondary button-small timetable-today"
          onClick={() => {
            setDate(today);
            setJump(null);
          }}
        >
          {p.backToday}
        </button>
      )}

      {reasons.length ? (
        <div className="py-5">
          <h3 className="font-semibold">
            {date === today ? p.todayOff : p.offDay}
          </h3>

          <ul>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          <button
            className="button button-secondary mt-4"
            onClick={() => navigate(1)}
          >
            {p.nearest}
          </button>
        </div>
      ) : rows.length ? (
        <WeeklyLessonList
          lessons={rows}
          date={date}
          canAddHomework={!!classId}
          subjects={subjects}
          grade={grade}
          materials={materials}
        />
      ) : (
        <p className="py-6 text-[var(--muted)]">
          {classId ? t.noToday : t.chooseProfileClass}
        </p>
      )}
    </section>
  );
}
