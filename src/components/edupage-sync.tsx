"use client";
import {useState,useTransition} from "react";
import type {ClassRow,SubjectRow} from "@/lib/database.types";
import type {WeeklyInput} from "@/lib/timetable-import";
import type {EduPageStatus} from "@/lib/edupage/state";
import {syncEduPage,type EduPageActionResult} from "@/app/actions/edupage";
import {normalizeAlias,resolveReference,type EduPageAliases} from "@/lib/edupage/mapping";
import {eduPageCopy} from "@/lib/edupage/copy";
import {subjectName} from "@/lib/i18n";
import {phase4Copy} from "@/lib/phase4-copy";
import {useI18n} from "./locale-provider";
export function EduPageSync({initial,classes,subjects,action=syncEduPage}:{
  initial:EduPageStatus;classes:ClassRow[];subjects:SubjectRow[];action?:(input:unknown)=>Promise<EduPageActionResult>;
}){
  const {locale}=useI18n(),t=eduPageCopy(locale);
  const [aliases,setAliases]=useState<EduPageAliases>(initial.aliases),[scope,setScope]=useState<string[]>([]);
  const [result,setResult]=useState<EduPageActionResult>({}),[dirty,setDirty]=useState(false),[confirmed,setConfirmed]=useState(false);
  const [pending,startTransition]=useTransition(),[visible,setVisible]=useState(100);
  const preview=result.preview;
  const change=()=>{setDirty(true);setConfirmed(false);};
  const run=(intent:"preview"|"confirm")=>{
    if(pending)return;
    startTransition(async()=>{
      try{const next=await action({intent,aliases,scope,fingerprint:preview?.fingerprint,confirm:confirmed});
        setResult(next);setDirty(!!next.error);setConfirmed(false);setVisible(100);
      }catch{setResult({error:"unavailable"});setDirty(true);setConfirmed(false);}
    });
  };
  const label=(row:WeeklyInput)=>[classes.find(c=>c.id===row.class_id)?.name,
    phase4Copy(locale).shortDays[row.weekday-1],row.lesson_start===row.lesson_end?row.lesson_start:row.lesson_start+"–"+row.lesson_end,
    subjectName(subjects.find(s=>s.id===row.subject_id),locale),row.subgroup_label,row.room,
    [row.start_time?.slice(0,5),row.end_time?.slice(0,5)].filter(Boolean).join("–"),
    row.effective_from??"…",row.effective_to??"…"].filter(Boolean).join(" · ");
  const date=(value:string|null|undefined)=>value?new Intl.DateTimeFormat(locale==="kk"?"kk-KZ":locale==="ru"?"ru-KZ":"en-GB",
    {timeZone:"Asia/Almaty",dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"—";
  const statusError=result.error??initial.error;
  const message=statusError&&statusError in t.errors?t.errors[statusError as keyof typeof t.errors]:null;
  const referenceSelect=(kind:"classes"|"subjects")=>{
    if(!preview)return null;
    const refs=kind==="classes"?preview.classes:preview.subjects;
    const catalog=kind==="classes"?classes.map(c=>({id:c.id,names:[c.name],label:c.name})):
      subjects.map(s=>({id:s.id,names:[s.name,s.name_ru,s.name_kz,s.name_en,s.short_name],label:subjectName(s,locale)}));
    return refs.map(ref=><label key={ref.id} className="block min-w-0">
      <span className="field-label break-words">{kind==="classes"?t.class:t.subject}: {ref.name}</span>
      <select className="field w-full min-w-0" value={resolveReference(ref,catalog,aliases[kind],kind==="classes")??""}
        onChange={event=>{const next={...aliases[kind]},key=normalizeAlias(ref.name);
          if(event.target.value)next[key]=event.target.value;else delete next[key];
          setAliases({...aliases,[kind]:next});change();}}>
        <option value="">{t.auto}</option>{catalog.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
      </select>
    </label>);
  };
  return <section className="surface-card mt-8 min-w-0 space-y-5" aria-labelledby="edupage-title" aria-busy={pending}>
    <h2 id="edupage-title" className="section-title">{t.title}</h2>
    <a className="text-link break-all" href="https://nisuralsk.edupage.org/timetable/" target="_blank" rel="noreferrer">https://nisuralsk.edupage.org/timetable/</a>
    <dl className="space-y-2 break-words">
      <div><dt>{t.checked}</dt><dd>{date(result.checkedAt??initial.lastChecked)}</dd></div>
      <div><dt>{t.synced}</dt><dd>{date(result.synced?result.checkedAt:initial.lastSynced)}</dd></div>
      <div><dt>{t.version}</dt><dd><a className="text-link break-all" href="/admin/versions">{result.version??initial.activeVersion??"—"}</a></dd></div>
    </dl>
    <p role="status">{pending?t.waiting:!initial.ready?t.migration:!initial.enabled?t.disabled:result.synced?t.saved:result.unchanged?t.noChanges:t.ready}</p>
    {message&&<p role="alert">{message}</p>}
    <button type="button" className="button button-secondary" disabled={pending||!initial.enabled||!initial.ready} onClick={()=>run("preview")}>{t.check}</button>
    {preview&&<>
      <p>{preview.publication.label} · {preview.publication.effectiveFrom} — {preview.publication.effectiveTo??"…"}</p>
      <fieldset disabled={pending} className="space-y-3"><legend className="field-label">{t.scope}</legend>
        <label className="flex items-start gap-2"><input type="checkbox" checked={!scope.length} onChange={()=>{setScope([]);change();}}/>{t.all}</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{preview.classes.map(c=><label key={c.id} className="flex items-start gap-2">
          <input type="checkbox" checked={!scope.length||scope.includes(c.id)}
            onChange={e=>{const current=scope.length?scope:preview.classes.map(c=>c.id);
              const next=e.target.checked?[...current,c.id]:current.filter(id=>id!==c.id);
              // An empty explicit selection must not silently mean "all".
              if(next.length){setScope(next);change();}
            }}/>{c.name}</label>)}</div>
      </fieldset>
      <details><summary>{t.aliases}</summary><div className="grid min-w-0 gap-4 pt-4 sm:grid-cols-2">
        {referenceSelect("classes")}{referenceSelect("subjects")}
      </div></details>
      <p>{t.hint}</p>
      <div role="status">{t.added}: {preview.diff.added.length} · {t.changed}: {preview.diff.changed.length} · {t.removed}: {preview.diff.removed.length} · {t.unchanged}: {preview.diff.unchanged.length}</div>
      {!!preview.blockedClasses.length&&<p role="status">{t.partial}: {preview.scope.length} · {t.skipped}: {preview.blockedClasses.length}</p>}
      {!!preview.issues.length&&<div role="alert"><h3>{t.issues}: {preview.issues.length}</h3>
        <p>{t.issuesHint}</p>
        <ul className="space-y-2 break-words">{preview.issues.slice(0,visible).map((issue,i)=><li key={i}>{t[issue.code]}: {issue.label}</li>)}</ul>
      </div>}
      {(["added","changed","removed","unchanged"] as const).map(kind=><details key={kind}>
        <summary>{t[kind]}: {preview.diff[kind].length}</summary>
        <ul className="space-y-2 break-words">{kind==="changed"?preview.diff.changed.slice(0,visible).map((row,i)=><li key={i}>{label(row.before)} → {label(row.after)}</li>):
          preview.diff[kind].slice(0,visible).map((row,i)=><li key={i}>{label(row)}</li>)}</ul>
      </details>)}
      {Math.max(preview.issues.length,...Object.values(preview.diff).map(rows=>rows.length))>visible&&
        <button type="button" className="button button-secondary" onClick={()=>setVisible(n=>n+100)}>{t.more}</button>}
      <label className="flex items-start gap-3"><input type="checkbox" checked={confirmed}
        disabled={pending||dirty||!preview.scope.length||!preview.rows.length}
        onChange={e=>setConfirmed(e.target.checked)}/><span>{t.confirm}</span></label>
      <button type="button" className="button" onClick={()=>run("confirm")}
        disabled={pending||dirty||!confirmed||!preview.scope.length||!preview.rows.length}>{t.sync}</button>
    </>}
  </section>;
}
