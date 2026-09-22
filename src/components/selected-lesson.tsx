"use client";
import Link from "next/link";
import type { SubjectRow, WeeklyLesson } from "@/lib/database.types";
import { subjectName } from "@/lib/i18n";
import { normalizeRoom } from "@/lib/catalog";
import { librarySubjectHref } from "@/lib/book-model";
import { materialKey, type MaterialMap } from "@/lib/schedule-materials";
import { studyHref } from "@/lib/study-dashboard";
import { designCopy } from "@/lib/design-copy";
import { eduPageCopy } from "@/lib/edupage/copy";
import { formatSchoolDate } from "@/lib/school-calendar";
import { useI18n } from "./locale-provider";
import { GlassSurface } from "./design/glass-surface";
import { SubjectMotif } from "./subject-motif";

export function SelectedLesson({lesson, subjects, date, grade = null, materials = {}}: {
  lesson?: WeeklyLesson; subjects: SubjectRow[]; date: string; grade?: number | null; materials?: MaterialMap;
}) {
  const {locale, t} = useI18n(), c = designCopy(locale);
  const subject = subjects.find(item => item.id === lesson?.subject_id);
  const href = lesson ? materials[materialKey(lesson.subject_id, grade)] ?? librarySubjectHref(lesson.subject_id, grade) : "";
  return <GlassSurface className="selected-lesson" aria-label={c.selected}>
    <div className="selected-lesson-content" key={(lesson?.id ?? "empty") + date}>
      <p className="eyebrow">{c.selected}</p>
      <time dateTime={date}>{formatSchoolDate(date, locale)}</time>
      <div className="selected-lesson-title" aria-live="polite" aria-atomic="true">
        {lesson && <SubjectMotif subject={subject}/>}
        <h2>{lesson ? subjectName(subject, locale) : c.select}</h2>
      </div>
      {lesson && <>
        <dl className="lesson-facts">
          {lesson.start_time && lesson.end_time && <div><dt>{t.lesson}</dt><dd>{lesson.start_time.slice(0,5)}–{lesson.end_time.slice(0,5)}</dd></div>}
          {lesson.room && <div><dt>{t.room}</dt><dd>{normalizeRoom(lesson.room)}</dd></div>}
          {lesson.subgroup_label && <div><dt>{eduPageCopy(locale).subgroup}</dt><dd>{lesson.subgroup_label}</dd></div>}
        </dl>
        <div className="selected-lesson-actions">
          <Link prefetch={false} className="button" href={href}>{t.openMaterial} <span aria-hidden="true">↗</span></Link>
          <Link prefetch={false} className="button button-secondary" href={studyHref(href)}>AI Study <span aria-hidden="true">✦</span></Link>
        </div>
        <p className="study-source-hint">{c.studyHint}</p>
      </>}
    </div>
  </GlassSurface>;
}
