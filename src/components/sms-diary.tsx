"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { connectSms, disconnectSms, refreshSms } from "@/app/actions/sms";
import { smsCopy } from "@/lib/sms/copy";
import type { SmsResult } from "@/lib/sms/types";
import type { SubjectRow } from "@/lib/database.types";
import { subjectName } from "@/lib/i18n";
import { useI18n } from "./locale-provider";
import { SubjectMotif } from "./subject-motif";
import { ActionMenu } from "./action-menu";
export function SmsDiary({enabled,sessionPresent,subjects=[]}:{enabled:boolean;sessionPresent:boolean;subjects?:SubjectRow[]}) {
  const {locale}=useI18n(), p=smsCopy(locale);
  const [result,setResult]=useState<SmsResult>({connected:sessionPresent,...(!enabled?{error:"feature_disabled" as const}:{})});
  const [pending,setPending]=useState(sessionPresent&&enabled);
  const initialized=useRef(false);
  const requestId=useRef(0);
  const localeTag=locale==="kk"?"kk-KZ":locale==="ru"?"ru-KZ":"en-GB";
  useEffect(()=>{
    if(initialized.current || !sessionPresent || !enabled) return;
    initialized.current=true;
    const id=++requestId.current;
    // One initial read; no polling, focus refresh or credential persistence.
    refreshSms().then(value=>{if(requestId.current===id)setResult(value);},()=>{if(requestId.current===id)setResult({connected:true,error:"sms_unavailable"});})
      .finally(()=>{if(requestId.current===id)setPending(false);});
  },[sessionPresent,enabled]);
  async function run(action:()=>Promise<SmsResult>) {
    const id=++requestId.current; setPending(true);
    try {const value=await action();if(requestId.current===id)setResult(value);}
    catch {if(requestId.current===id)setResult({connected:result.connected,error:"sms_unavailable"});}
    finally {if(requestId.current===id)setPending(false);}
  }
  function connect(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    // Uncontrolled inputs: remove visible credentials immediately. Never URL/state/storage.
    event.currentTarget.reset();
    void run(async()=>{try{return await connectSms(form);}finally{form.delete("iin");form.delete("password");}});
  }
  const snapshot=result.snapshot;
  function matchingSubject(name:string) {
    const normalize=(value:string)=>value.normalize("NFKC").toLocaleLowerCase().trim();
    const matches=subjects.filter(s=>[s.name,s.name_ru,s.name_kz,s.name_en,s.short_name].some(v=>v&&normalize(v)===normalize(name)));
    return matches.length===1?matches[0]:undefined;
  }
  return <section className="sms-diary" aria-label={p.title} aria-busy={pending}>
    {!result.connected ? <div className="surface-card sms-connect">
      <p className="eyebrow">NIS Hub × SMS</p><h2>{p.connect}</h2>
      <p id="sms-privacy">{p.privacy}</p><p>{p.consent}</p>
      <form onSubmit={connect} aria-describedby="sms-privacy">
        <label htmlFor="sms-iin">{p.iin}</label>
        <input id="sms-iin" name="iin" inputMode="numeric" autoComplete="username" pattern="[0-9]{12}" minLength={12} maxLength={12} required disabled={!enabled||pending}/>
        <label htmlFor="sms-password">{p.password}</label>
        <input id="sms-password" name="password" type="password" autoComplete="current-password" maxLength={256} required disabled={!enabled||pending}/>
        <button className="button" type="submit" disabled={!enabled||pending}>{pending?p.pending:p.connect}</button>
      </form>
    </div> : <div className="sms-toolbar surface-card">
      <div><p className="eyebrow">{p.connected}</p><p>{p.source}</p>
        {snapshot?.student.displayName&&<h2>{snapshot.student.displayName}</h2>}
        {snapshot?.student.className&&<p>{snapshot.student.className}</p>}
        {snapshot?.student.schoolYear&&<p>{p.year}: {snapshot.student.schoolYear}</p>}
        {snapshot?.student.term&&<p>{p.term}: {snapshot.student.term}</p>}
        {snapshot&&<p>{p.updated}: <time dateTime={snapshot.fetchedAt}>{new Intl.DateTimeFormat(localeTag,{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Oral"}).format(new Date(snapshot.fetchedAt))}</time></p>}
      </div>
      <div className="sms-actions"><button className="button button-secondary" onClick={()=>void run(refreshSms)} disabled={!enabled||pending}>{p.refresh}</button>
        <ActionMenu label={p.actions}>{close=><button type="button" role="menuitem" disabled={pending} onClick={()=>{close();void run(disconnectSms);}}>{p.disconnect}</button>}</ActionMenu>
      </div>
    </div>}
    {pending&&<p role="status">{p.pending}</p>}
    {result.error&&<p className="notice notice-error" role="alert">{p.errors[result.error]}</p>}
    {snapshot&&!pending&&<div className="sms-subjects">
      {!snapshot.subjects.length&&<p className="surface-card">{p.empty}</p>}
      {snapshot.subjects.map(s=>{
        const subject=matchingSubject(s.subject);
        return <article className="surface-card sms-subject" key={s.subject}>
          <div className="sms-subject-heading"><SubjectMotif subject={subject}/><div><h2>{subject?subjectName(subject,locale):s.subject}</h2>
            <p className="sms-percent">{s.percent===undefined?"—":new Intl.NumberFormat(localeTag,{maximumFractionDigits:1}).format(s.percent)+"%"}</p>
            <p className="text-sm">{s.percent===undefined?p.noScore:s.percentSource==="derived"?p.derived:p.official}</p>
          </div></div>
          <details><summary>{p.assessment} · {s.assessments.length}</summary>
            <ol className="sms-assessments">{s.assessments.map((a,index)=><li key={index}>
              <div><strong>{a.title || (a.type?p.types[a.type]:p.assessment)}</strong>{a.title&&a.type&&<span>{p.types[a.type]}</span>}
                {a.date&&<time dateTime={a.date}>{new Intl.DateTimeFormat(localeTag,{dateStyle:"medium",timeZone:"UTC"}).format(new Date(a.date+"T12:00:00Z"))}</time>}
              </div><div><span>{p.score}: {a.score??"—"}{a.max!==undefined?" / "+a.max:""}</span>
                {a.percent!==undefined&&<span>{new Intl.NumberFormat(localeTag,{maximumFractionDigits:1}).format(a.percent)}% · {a.percentSource==="derived"?p.derived:p.official}</span>}
              </div>
            </li>)}</ol>
          </details>
        </article>;
      })}
    </div>}
  </section>;
}
