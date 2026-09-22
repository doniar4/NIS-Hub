"use client";
import Link from "next/link";
import {useEffect, useState} from "react";
import {loadHomework} from "@/app/actions/homework";
import type {ClassHomework, SubjectRow} from "@/lib/database.types";
import {subjectName} from "@/lib/i18n";
import {designCopy} from "@/lib/design-copy";
import {v053Copy} from "@/lib/v053-copy";
import {formatSchoolDate} from "@/lib/school-calendar";
import {useI18n} from "./locale-provider";

export function HomeworkPreview({date, subjects, hasClass}: {date:string; subjects:SubjectRow[]; hasClass:boolean}) {
  // A date-keyed child cannot briefly show the previous day's work while loading.
  return <HomeworkForDate key={date} date={date} subjects={subjects} hasClass={hasClass}/>;
}
function HomeworkForDate({date, subjects, hasClass}: {date:string; subjects:SubjectRow[]; hasClass:boolean}) {
  const {locale,t}=useI18n(), c=designCopy(locale);
  const [result,setResult]=useState<{rows:ClassHomework[]; failed:boolean}|null>(null);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!hasClass)return;
    let active=true;
    void loadHomework(date).then(r=>{if(active)setResult("error" in r?{rows:[],failed:true}:{rows:r.data,failed:false});})
      .catch(()=>{if(active)setResult({rows:[],failed:true});});
    return ()=>{active=false;};
  },[date,hasClass,revision]);
  useEffect(()=>{
    const refresh=()=>{setResult(null);setRevision(v=>v+1);};
    window.addEventListener("nis-homework-change",refresh);
    return ()=>window.removeEventListener("nis-homework-change",refresh);
  },[]);
  return <section className="surface-card homework-preview" aria-busy={hasClass&&!result}>
    <h2 className="section-title">{c.homework}</h2>
    <p className="panel-caption"><time dateTime={date}>{formatSchoolDate(date,locale)}</time></p>
    {!hasClass?<p>{t.chooseProfileClass}</p>:!result?<p role="status">{c.loading}</p>:result.failed?<div role="alert"><p>{c.loadError}</p><button className="button button-secondary" onClick={()=>{setResult(null);setRevision(v=>v+1);}}>{c.retry}</button></div>:result.rows.length?
      <ul className="compact-entries">{result.rows.slice(0,3).map(row=><li key={row.id}><h3>{subjectName(subjects.find(s=>s.id===row.subject_id),locale)}</h3><p className="homework-excerpt">{row.body}</p></li>)}</ul>:<p>{v053Copy(locale).none}</p>}
    <Link className="section-link" href={"/schedule?date="+date+"#homework"}>{c.homeworkFull} →</Link>
  </section>;
}
