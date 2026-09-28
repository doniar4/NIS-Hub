"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SubjectRow, WeeklyLesson } from "@/lib/database.types";
import { schoolWeek, weeklyDay, lessonRange } from "@/lib/weekly-schedule";
import { subjectName } from "@/lib/i18n";
import { normalizeRoom, subjectMap } from "@/lib/catalog";
import { SubjectMotif } from "./subject-motif";
import { useI18n } from "./locale-provider";
import { materialKey, type MaterialMap } from "@/lib/schedule-materials";
import { librarySubjectHref } from "@/lib/book-model";

interface CurrentLessonHeroProps {
  lessons: WeeklyLesson[];
  subjects: SubjectRow[];
  classId: string;
  today: string;
  grade?: number | null;
  materials?: MaterialMap;
}

export function CurrentLessonHero({
  lessons,
  subjects,
  classId,
  today,
  grade = null,
  materials = {},
}: CurrentLessonHeroProps) {
  const { locale, t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  const subjectsById = useMemo(() => subjectMap(subjects), [subjects]);

  // Tick clock every 1 second
  useEffect(() => {
    const mountFrame = requestAnimationFrame(() => setMounted(true));
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      cancelAnimationFrame(mountFrame);
      clearInterval(interval);
    };
  }, []);

  // Filter lessons for today
  const todayWeekday = schoolWeek(today).weekday;
  const todayLessons = useMemo(() => {
    const list = weeklyDay(lessons, classId, todayWeekday, today);
    return [...list].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [lessons, classId, todayWeekday, today]);

  // Compute school time in seconds from midnight
  const nowParts = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Oral",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const s = parseInt(parts.find((p) => p.type === "second")?.value ?? "0", 10);
    return h * 3600 + m * 60 + s;
  }, [now]);

  // Helper to parse time string "HH:MM" or "HH:MM:SS" into seconds
  const parseSeconds = (timeStr?: string | null) => {
    if (!timeStr) return null;
    const [h, m, s] = timeStr.split(":").map((v) => parseInt(v, 10));
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  };

  const formatCountdown = (totalSec: number) => {
    const clamped = Math.max(0, totalSec);
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Determine current school state
  const status = useMemo(() => {
    if (!todayLessons.length) {
      return { type: "no_lessons" as const };
    }

    const first = todayLessons[0];
    const last = todayLessons[todayLessons.length - 1];
    const firstStart = parseSeconds(first.start_time);
    const lastEnd = parseSeconds(last.end_time);

    // Before school starts today
    if (firstStart !== null && nowParts < firstStart) {
      return {
        type: "before_school" as const,
        nextLesson: first,
        secondsUntil: firstStart - nowParts,
      };
    }

    // After all lessons today
    if (lastEnd !== null && nowParts >= lastEnd) {
      return { type: "after_school" as const };
    }

    // Check each lesson
    for (let i = 0; i < todayLessons.length; i++) {
      const lesson = todayLessons[i];
      const start = parseSeconds(lesson.start_time);
      const end = parseSeconds(lesson.end_time);

      if (start !== null && end !== null) {
        if (nowParts >= start && nowParts < end) {
          const duration = Math.max(1, end - start);
          const elapsed = nowParts - start;
          const percent = Math.min(100, Math.max(0, (elapsed / duration) * 100));
          return {
            type: "ongoing" as const,
            lesson,
            index: i + 1,
            secondsLeft: end - nowParts,
            percent,
          };
        }

        // Check if we are in break before the next lesson
        if (nowParts < start) {
          return {
            type: "break" as const,
            nextLesson: lesson,
            index: i + 1,
            secondsUntil: start - nowParts,
          };
        }
      }
    }

    return { type: "after_school" as const };
  }, [todayLessons, nowParts]);

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  const totalLessons = todayLessons.length;

  // ─── Ongoing lesson ───
  if (status.type === "ongoing") {
    const s = subjectsById.get(status.lesson.subject_id);
    const sName = subjectName(s, locale);
    const room = normalizeRoom(status.lesson.room);
    const lessonNum = lessonRange(status.lesson) || status.index;
    const materialHref = materials[materialKey(status.lesson.subject_id, grade)] ?? librarySubjectHref(status.lesson.subject_id, grade);

    return (
      <aside className="lesson-status-bar surface-card is-live" aria-label={sName}>
        {/* Progress track */}
        <div className="status-progress-track" aria-hidden="true">
          <div className="status-progress-fill" style={{ width: `${status.percent}%` }} />
        </div>

        <div className="status-bar-row">
          <div className="status-bar-left">
            <div className="status-motif">
              <SubjectMotif subject={s} />
            </div>
            <div className="status-info">
              <div className="status-meta">
                <span className="status-live-dot" aria-hidden="true" />
                <span className="status-tag is-live-tag">
                  {locale === "kk" ? `${lessonNum}-сабақ` : locale === "en" ? `Lesson ${lessonNum}` : `${lessonNum}-й урок`}
                </span>
                {room && <span className="status-pill">{room}</span>}
                {status.lesson.start_time && status.lesson.end_time && (
                  <span className="status-pill">{status.lesson.start_time.slice(0, 5)}–{status.lesson.end_time.slice(0, 5)}</span>
                )}
              </div>
              <h2 className="status-subject">{sName}</h2>
            </div>
          </div>

          <div className="status-bar-actions">
            <Link prefetch={false} className="status-material-link" href={materialHref}>
              <span aria-hidden="true">▣</span>{locale === "kk" ? "Оқулық" : locale === "en" ? "Textbook" : "Учебник"}
            </Link>
            <div className="status-timer">
              <span className="status-timer-value">{formatCountdown(status.secondsLeft)}</span>
              <span className="status-timer-label">
                {locale === "kk" ? "қоңырау" : locale === "en" ? "bell" : "звонок"}
              </span>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // ─── Break between lessons ───
  if (status.type === "break") {
    const s = subjectsById.get(status.nextLesson.subject_id);
    const sName = subjectName(s, locale);
    const room = normalizeRoom(status.nextLesson.room);
    const lessonNum = lessonRange(status.nextLesson) || status.index;

    return (
      <aside className="lesson-status-bar surface-card is-break" aria-label={sName}>
        <div className="status-bar-row">
          <div className="status-bar-left">
            <div className="status-motif">
              <SubjectMotif subject={s} />
            </div>
            <div className="status-info">
              <div className="status-meta">
                <span className="status-tag is-break-tag">
                  {locale === "kk" ? "Үзіліс" : locale === "en" ? "Break" : "Перемена"}
                </span>
                <span className="status-separator">→</span>
                <span className="status-tag">
                  {locale === "kk" ? `${lessonNum}-сабақ` : locale === "en" ? `Lesson ${lessonNum}` : `${lessonNum}-й урок`}
                </span>
                {room && <span className="status-pill">{room}</span>}
              </div>
              <h2 className="status-subject">{sName}</h2>
            </div>
          </div>

          <div className="status-timer">
            <span className="status-timer-value">{formatCountdown(status.secondsUntil)}</span>
            <span className="status-timer-label">
              {locale === "kk" ? "басталуы" : locale === "en" ? "starts" : "начало"}
            </span>
          </div>
        </div>
      </aside>
    );
  }

  // ─── Before school ───
  if (status.type === "before_school") {
    const s = subjectsById.get(status.nextLesson.subject_id);
    const sName = subjectName(s, locale);
    const room = normalizeRoom(status.nextLesson.room);

    return (
      <aside className="lesson-status-bar surface-card" aria-label={sName}>
        <div className="status-bar-row">
          <div className="status-bar-left">
            <div className="status-motif">
              <SubjectMotif subject={s} />
            </div>
            <div className="status-info">
              <div className="status-meta">
                <span className="status-tag">
                  {locale === "kk" ? "1-сабақ" : locale === "en" ? "Lesson 1" : "1-й урок"}
                </span>
                {room && <span className="status-pill">{room}</span>}
                {status.nextLesson.start_time && (
                  <span className="status-pill">{status.nextLesson.start_time.slice(0, 5)}</span>
                )}
                <span className="status-count-pill">
                  {locale === "kk" ? `${totalLessons} сабақ` : locale === "en" ? `${totalLessons} lessons` : `${totalLessons} уроков`}
                </span>
              </div>
              <h2 className="status-subject">{sName}</h2>
            </div>
          </div>

          <div className="status-timer">
            <span className="status-timer-value">{formatCountdown(status.secondsUntil)}</span>
            <span className="status-timer-label">
              {locale === "kk" ? "дейін" : locale === "en" ? "until" : "до начала"}
            </span>
          </div>
        </div>
      </aside>
    );
  }

  // ─── Day completed ───
  if (status.type === "after_school") {
    return (
      <aside className="lesson-status-bar surface-card is-done" aria-label="done">
        <div className="status-done-glow" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="status-bar-row">
          <div className="status-bar-left">
            <div className="status-done-icon" aria-hidden="true">✓</div>
            <div className="status-info">
              <div className="status-meta">
                <span className="status-tag is-done-tag">
                  {locale === "kk" ? "Аяқталды" : locale === "en" ? "Complete" : "Завершено"}
                </span>
                <span className="status-count-pill">
                  {locale === "kk" ? `${totalLessons} сабақ` : locale === "en" ? `${totalLessons} lessons` : `${totalLessons} уроков`}
                </span>
              </div>
              <h2 className="status-subject">
                {locale === "kk"
                  ? "Бүгінгі сабақтар аяқталды"
                  : locale === "en"
                  ? "All lessons complete"
                  : "Уроки на сегодня завершены"}
              </h2>
              <p className="status-done-copy">
                {locale === "kk"
                  ? "Бүгінгі жоспар орындалды. Енді демалуға болады."
                  : locale === "en"
                  ? "Today’s plan is complete. Time to recharge."
                  : "План на день выполнен. Можно выдохнуть."}
              </p>
            </div>
          </div>
          <div className="status-done-total" aria-hidden="true">
            <strong>{totalLessons}</strong>
            <span>{locale === "kk" ? "бүгінгі сабақ" : locale === "en" ? "lessons today" : "урока сегодня"}</span>
          </div>
        </div>
      </aside>
    );
  }

  return null;
}
