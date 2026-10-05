"use client";
import Link from "next/link";
import type {SubjectRow} from "@/lib/database.types";
import {subjectName} from "@/lib/i18n";
import {designCopy} from "@/lib/design-copy";
import {v053Copy} from "@/lib/v053-copy";
import {formatSchoolDate} from "@/lib/school-calendar";
import {useI18n} from "./locale-provider";
import {TelegramHomeworkCta, TelegramHomeworkLink} from "./telegram-homework-cta";
import {useHomeworkDay} from "./day-homework-provider";

export function HomeworkPreview({date, subjects, hasClass}: {date:string; subjects:SubjectRow[]; hasClass:boolean}) {
  // A date-keyed child cannot briefly show the previous day's work while loading.
  return <HomeworkForDate key={date} date={date} subjects={subjects} hasClass={hasClass}/>;
}
function HomeworkForDate({date, subjects, hasClass}: {date:string; subjects:SubjectRow[]; hasClass:boolean}) {
  const {locale,t}=useI18n(), c=designCopy(locale);
  const result=useHomeworkDay(date,hasClass);
  return <section className="surface-card homework-preview" aria-busy={result.loading}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="section-title">{c.homework}</h2>
      <TelegramHomeworkLink locale={locale} compact />
    </div>
    <p className="panel-caption"><time dateTime={date}>{formatSchoolDate(date,locale)}</time></p>
    {!hasClass?<p>{t.chooseProfileClass}</p>:result.loading?<p role="status">{c.loading}</p>:result.error?<div role="alert"><p>{c.loadError}</p><button className="button button-secondary" onClick={()=>window.dispatchEvent(new Event("nis-homework-change"))}>{c.retry}</button></div>:result.rows.length?
      <ul className="compact-entries">{result.rows.slice(0,3).map(row=><li key={row.id}><h3>{subjectName(subjects.find(s=>s.id===row.subject_id),locale)}</h3><p className="homework-excerpt">{row.body}</p></li>)}</ul>:<p>{v053Copy(locale).none}</p>}
    <Link className="section-link" href={"/schedule?date="+date+"#homework"}>{c.homeworkFull} →</Link>
    <TelegramHomeworkCta locale={locale}/>
  </section>;
}
