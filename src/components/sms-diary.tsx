"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { connectSms, disconnectSms, loadSmsSubject, refreshSms } from "@/app/actions/sms";
import { smsCopy } from "@/lib/sms/copy";
import type { SmsAssessment, SmsErrorCode, SmsResult } from "@/lib/sms/types";
import type { SubjectRow } from "@/lib/database.types";
import { subjectName } from "@/lib/i18n";
import { useI18n } from "./locale-provider";
import { SubjectMotif } from "./subject-motif";
import { ActionMenu } from "./action-menu";
import { DiaryMotion } from "./diary-motion";

function RefreshIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M20 11a8 8 0 1 0-2.34 5.66" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M20 5v6h-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function ShieldIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 3 5.5 5.6v5.7c0 4.2 2.7 7.8 6.5 9.7 3.8-1.9 6.5-5.5 6.5-9.7V5.6L12 3Z" stroke="currentColor" strokeWidth="1.6"/><path d="m9.3 12 1.8 1.8 3.8-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function ChevronIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function SmsDiary({enabled,sessionPresent,subjects=[]}:{enabled:boolean;sessionPresent:boolean;subjects?:SubjectRow[]}) {
  const {locale}=useI18n(), p=smsCopy(locale);
  const [result,setResult]=useState<SmsResult>({connected:sessionPresent,...(!enabled?{error:"feature_disabled" as const}:{})});
  const [pending,setPending]=useState(sessionPresent&&enabled);
  const [details,setDetails]=useState<Record<string,{loading?:boolean;assessments?:SmsAssessment[];error?:SmsErrorCode}>>({});
  const initialized=useRef(false);
  const requestId=useRef(0);
  const localeTag=locale==="kk"?"kk-KZ":locale==="ru"?"ru-KZ":"en-GB";
  useEffect(()=>{
    if(initialized.current || !sessionPresent || !enabled) return;
    initialized.current=true;
    const id=++requestId.current;
    refreshSms().then(value=>{if(requestId.current===id)setResult(value);},()=>{if(requestId.current===id)setResult({connected:true,error:"sms_unavailable"});})
      .finally(()=>{if(requestId.current===id)setPending(false);});
  },[sessionPresent,enabled]);
  async function run(action:()=>Promise<SmsResult>) {
    const id=++requestId.current; setPending(true);
    try {const value=await action();if(requestId.current===id){setResult(value);setDetails({});}}
    catch {if(requestId.current===id)setResult({connected:result.connected,error:"sms_unavailable"});}
    finally {if(requestId.current===id)setPending(false);}
  }
  function connect(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    event.currentTarget.reset();
    void run(async()=>{try{return await connectSms(form);}finally{form.delete("iin");form.delete("password");}});
  }
  const snapshot=result.snapshot;
  function matchingSubject(name:string) {
    const normalize=(value:string)=>value.normalize("NFKC").toLocaleLowerCase().trim();
    const matches=subjects.filter(s=>[s.name,s.name_ru,s.name_kz,s.name_en,s.short_name].some(v=>v&&normalize(v)===normalize(name)));
    return matches.length===1?matches[0]:undefined;
  }
  const formatNumber=(value:number)=>new Intl.NumberFormat(localeTag,{maximumFractionDigits:1}).format(value);
  const selection=snapshot?.filters?{yearId:snapshot.filters.yearId,termId:snapshot.filters.termId}:{};
  async function loadDetails(subjectId:string) {
    if(details[subjectId]?.loading||details[subjectId]?.assessments||!snapshot?.filters?.termId)return;
    setDetails(value=>({...value,[subjectId]:{loading:true}}));
    const loaded=await loadSmsSubject({yearId:snapshot.filters.yearId,termId:snapshot.filters.termId},subjectId);
    setDetails(value=>({...value,[subjectId]:loaded.assessments?{assessments:loaded.assessments}:{error:loaded.error||"sms_unavailable"}}));
  }

  return <DiaryMotion><section className="sms-diary" aria-label={p.title} aria-busy={pending}>
    {!result.connected ? <div className="sms-connect-shell" data-diary-arrive>
      <div className="surface-card sms-connect">
        <p className="eyebrow">NIS Hub × SMS</p>
        <h2>{p.connect}</h2>
        <p className="sms-connect-lead">{p.consent}</p>
        <form onSubmit={connect} aria-describedby="sms-privacy">
          <label htmlFor="sms-iin">{p.iin}</label>
          <input id="sms-iin" name="iin" className="field" inputMode="numeric" autoComplete="username" pattern="[0-9]{12}" minLength={12} maxLength={12} required disabled={!enabled||pending}/>
          <label htmlFor="sms-password">{p.password}</label>
          <input id="sms-password" name="password" className="field" type="password" autoComplete="current-password" maxLength={256} required disabled={!enabled||pending}/>
          <button className="button sms-connect-button" type="submit" disabled={!enabled||pending}>{pending?p.pending:p.connect}</button>
        </form>
      </div>
      <aside className="sms-privacy-panel" id="sms-privacy">
        <span className="sms-privacy-icon"><ShieldIcon/></span>
        <div><strong>{p.source}</strong><p>{p.privacy}</p></div>
      </aside>
    </div> : <div className="sms-toolbar" data-diary-arrive>
      <div className="sms-toolbar-copy">
        <div className="sms-connection-state"><span className="sms-status-dot"/>{p.connected}</div>
        {snapshot?.student.displayName?<h2>{snapshot.student.displayName}</h2>:<h2>{p.title}</h2>}
        <p>{p.source}</p>
        {snapshot&&<p className="sms-updated">{p.updated}: <time dateTime={snapshot.fetchedAt}>{new Intl.DateTimeFormat(localeTag,{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Oral"}).format(new Date(snapshot.fetchedAt))}</time></p>}
      </div>
      <div className="sms-actions">
        <button className="button button-secondary sms-refresh" onClick={()=>void run(()=>refreshSms(selection))} disabled={!enabled||pending} aria-busy={pending}><RefreshIcon/>{p.refresh}</button>
        <ActionMenu label={p.actions}>{close=><button type="button" role="menuitem" disabled={pending} onClick={()=>{close();void run(disconnectSms);}}>{p.disconnect}</button>}</ActionMenu>
      </div>
      {snapshot&&<div className="sms-context" aria-label={`${p.year}, ${p.term}`}>
        {snapshot.student.className&&<div className="sms-context-readonly"><span>{p.className}</span><strong>{snapshot.student.className}</strong></div>}
        {snapshot.filters?<>
          <label className="sms-filter"><span>{p.year}</span><select value={snapshot.filters.yearId} disabled={pending} onChange={event=>void run(()=>refreshSms({yearId:event.currentTarget.value}))}>{snapshot.filters.years.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="sms-filter"><span>{p.term}</span><select value={snapshot.filters.termId??""} disabled={pending} onChange={event=>void run(()=>refreshSms({yearId:snapshot.filters!.yearId,...(event.currentTarget.value?{termId:event.currentTarget.value}:{})}))}><option value="">{p.selectTerm}</option>{snapshot.filters.terms.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        </>:<>
          {snapshot.student.schoolYear&&<div className="sms-context-readonly"><span>{p.year}</span><strong>{snapshot.student.schoolYear}</strong></div>}
          {snapshot.student.term&&<div className="sms-context-readonly"><span>{p.term}</span><strong>{snapshot.student.term}</strong></div>}
        </>}
      </div>}
    </div>}
    {pending&&<div className="sms-progress" role="status"><span/>{p.pending}</div>}
    {result.error&&<p className="notice notice-error" role="alert" data-diary-arrive>{p.errors[result.error]}</p>}
    {snapshot&&!pending&&<div className="sms-subjects">
      {!snapshot.subjects.length&&<p className="surface-card sms-empty">{snapshot.filters&&!snapshot.filters.termId?p.selectTerm:p.empty}</p>}
      {snapshot.subjects.map((s,index)=>{
        const subject=matchingSubject(s.subject);
        const detail=s.sourceId?details[s.sourceId]:undefined;
        const assessments=detail?.assessments??s.assessments;
        const sor=assessments.filter(item=>item.type==="sor").length;
        const soch=assessments.filter(item=>item.type==="soch").length;
        const categories=[...new Map((s.evaluations??[]).map(item=>[item.type??item.id,{label:item.type?p.types[item.type]:item.shortLabel||item.label,title:item.label}])).values()];
        return <article className={`sms-subject${snapshot.subjects.length%2===1&&index===snapshot.subjects.length-1?" sms-subject-wide":""}`} key={s.sourceId??s.subject} data-diary-card>
          <header className="sms-subject-heading">
            <div data-diary-motif><SubjectMotif subject={subject}/></div>
            <div className="sms-subject-title"><h2>{subject?subjectName(subject,locale):s.subject}</h2>
              <div className="sms-result-line"><strong>{s.percent===undefined?"—":formatNumber(s.percent)+"%"}</strong><span>{s.percent===undefined?p.noScore:s.percentSource==="derived"?p.derived:p.official}</span></div>
            </div>
          </header>
          <div className="sms-subject-meta" aria-label={p.assessment}>
            {s.currentMark!==undefined&&<span>{p.currentMark}: <strong>{formatNumber(s.currentMark)}</strong></span>}
            {s.notAttested&&<span><strong>{p.notAttested}</strong></span>}
            {!!s.evaluations?.length&&<span>{p.categories}: <strong>{s.evaluations.length}</strong></span>}
            {categories.map(category=><span key={category.title} title={category.title}><strong>{category.label}</strong></span>)}
            {!!detail?.assessments&&<span>{p.assessment}: <strong>{assessments.length}</strong></span>}
            {sor>0&&<span>{p.types.sor}: <strong>{sor}</strong></span>}
            {soch>0&&<span>{p.types.soch}: <strong>{soch}</strong></span>}
          </div>
          <details className="sms-subject-details" onToggle={event=>{if(event.currentTarget.open&&s.sourceId)void loadDetails(s.sourceId);}}>
            <summary><span>{p.assessment}{detail?.assessments?` · ${assessments.length}`:""}</span><ChevronIcon/></summary>
            {detail?.loading&&<p className="sms-detail-state" role="status">{p.detailsLoading}</p>}
            {detail?.error&&<p className="sms-detail-state notice-error" role="alert">{p.errors[detail.error]}</p>}
            {!detail?.loading&&!detail?.error&&<ol className="sms-assessments">{assessments.map((a,assessmentIndex)=><li key={`${a.title??a.type??"assessment"}-${assessmentIndex}`}>
              <div className="sms-assessment-copy"><strong>{a.title || (a.type?p.types[a.type]:p.assessment)}</strong>{a.title&&a.type&&<span>{p.types[a.type]}</span>}
                {a.date&&<time dateTime={a.date}>{new Intl.DateTimeFormat(localeTag,{dateStyle:"medium",timeZone:"UTC"}).format(new Date(a.date+"T12:00:00Z"))}</time>}
              </div><div className="sms-assessment-score"><span>{p.score}</span><strong>{a.score??"—"}{a.max!==undefined?" / "+a.max:""}</strong>
                {a.percent!==undefined&&<small>{formatNumber(a.percent)}% · {a.percentSource==="derived"?p.derived:p.official}</small>}
              </div>
            </li>)}</ol>}
          </details>
        </article>;
      })}
    </div>}
  </section></DiaryMotion>;
}
