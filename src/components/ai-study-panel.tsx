"use client";
import {useState,useTransition} from "react";
import {generateStudy} from "@/app/actions/ai-study";
import {STUDY_MODES,type StudyInput,type StudyResult} from "@/lib/ai-study";
import {v051Copy} from "@/lib/v051-copy";
import {useI18n} from "./locale-provider";
import {MagicWandIcon, ChevronDownIcon} from "@radix-ui/react-icons";
import {communityCopy} from "@/lib/community-copy";
import {AiGenerateButton} from "./ai-generate-button";
const labels={
 ru:{overview:"Обзор",concepts:"Ключевые понятия",definitions:"Определения",facts:"Формулы и факты",confusions:"Что можно перепутать",mistakes:"Ошибки по материалу",questions:"Самопроверка",checklist:"Чек-лист"},
 kk:{overview:"Шолу",concepts:"Негізгі ұғымдар",definitions:"Анықтамалар",facts:"Формулалар мен деректер",confusions:"Шатастыруға болатын тұстар",mistakes:"Материал бойынша қателер",questions:"Өзін-өзі тексеру",checklist:"Тексеру тізімі"},
 en:{overview:"Overview",concepts:"Key concepts",definitions:"Definitions",facts:"Formulas and facts",confusions:"Potential confusions",mistakes:"Source-based mistakes",questions:"Self-check",checklist:"Checklist"}
};
export type AiPanelConfig={enabled:boolean;maxPages:number;maxChars:number;dailyLimit:number};
export function AiStudyPanel({variantId,totalPages,initialPage,config}:{variantId:string;totalPages:number|null;initialPage:number;config:AiPanelConfig}){
 const {locale,t}=useI18n(),p=v051Copy(locale);
 const [start,setStart]=useState(String(initialPage)),[end,setEnd]=useState(String(initialPage)),[mode,setMode]=useState<StudyInput["mode"]>("summary");
 const [result,setResult]=useState<StudyResult|null>(null),[pending,transition]=useTransition();
 return <aside className="ai-study-panel"><details className="surface-card"><summary className="ai-study-summary"><MagicWandIcon aria-hidden="true"/><span><strong>{p.ai}</strong><small>{communityCopy(locale).aiHelp}</small></span><ChevronDownIcon className="ai-study-chevron" aria-hidden="true"/></summary>
 {!config.enabled?<p className="mt-4">{p.aiDisabled}</p>:<div className="mt-5 space-y-5"><p className="text-sm">{p.aiConsent}</p>
 <p className="text-sm text-[var(--muted)]">{p.limit}<br/>{config.maxPages} {t.pages} · {config.maxChars.toLocaleString(locale)} · {config.dailyLimit}/24h</p>
 <form className="space-y-4" onSubmit={event=>{event.preventDefault();setResult(null);transition(async()=>{try{setResult(await generateStudy({variantId,start:Number(start),end:Number(end),mode,locale}));}catch{setResult({error:"failed"});}});}}>
 <fieldset disabled={pending} className="space-y-4"><div className="grid grid-cols-2 gap-3">
 <label><span className="field-label">{p.from}</span><input className="field" type="number" min={1} max={totalPages??1000} required value={start} onChange={e=>{setStart(e.target.value);setResult(null);}}/></label>
 <label><span className="field-label">{p.to}</span><input className="field" type="number" min={Number(start)||1} max={Math.min(totalPages??1000,(Number(start)||1)+config.maxPages-1)} required value={end} onChange={e=>{setEnd(e.target.value);setResult(null);}}/></label></div>
 <label className="block"><span className="field-label">{p.ai}</span><select className="field" value={mode} onChange={e=>{setMode(e.target.value as StudyInput["mode"]);setResult(null);}}>{STUDY_MODES.map(value=><option key={value} value={value}>{p.modes[value]}</option>)}</select></label>
 <AiGenerateButton pending={pending} label={pending?p.working:p.generate}/></fieldset></form>
 {pending&&<p role="status">{p.working}</p>}{result?.error&&<p role="alert">{result.error==="configuration"?p.aiConfiguration:result.error==="timeout"?p.aiTimeout:result.error==="busy"?p.aiBusy:result.error==="provider_quota"?p.aiProviderQuota:result.error==="quota"?p.quota:result.error==="unavailable"?p.unavailable:result.error==="disabled"?p.aiDisabled:p.aiError}</p>}
 {result?.response&&result.source&&<section className="space-y-4" aria-label={p.ai}>
 <p className="font-semibold">{p.source}: {t.pages} {result.source.start}–{result.source.end}</p>
 {result.cached&&<p className="text-sm">{p.cached}</p>}{result.response.insufficient&&<p>{p.insufficient}</p>}
 {result.response.sections.map(section=><section key={section.kind}><h3 className="font-semibold">{labels[locale][section.kind]}</h3>{section.insufficient&&<p>{p.insufficient}</p>}
 <ul className="mt-2 space-y-4">{section.points.map((point,index)=><li key={index}><p className="whitespace-pre-wrap break-words">{point.text}</p>{point.evidence.map((citation,n)=><blockquote key={n} className="mt-2 border-l-2 border-[var(--line)] pl-3 text-sm text-[var(--muted)]"><p>“{citation.quote}”</p><cite>{t.page} {citation.page}</cite></blockquote>)}</li>)}</ul></section>)}</section>}
 </div>}</details></aside>;
}
