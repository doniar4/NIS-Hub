"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { safetyAction } from "@/app/actions/community-safety";
import { loadReportContext,moderateHomework } from "@/app/actions/homework";
import { v053Copy } from "@/lib/v053-copy";
import { useI18n } from "./locale-provider";
import type { CommunityReport } from "@/lib/database.types";
export function ReportModeration({reports}:{reports:CommunityReport[]}){
 const {locale}=useI18n(),p=v053Copy(locale),router=useRouter(),[error,setError]=useState(""),[contexts,setContexts]=useState<Record<string,string>>({}),[pending,start]=useTransition();
 return <div className="space-y-4">{error&&<p role="alert">{error}</p>}{!reports.length&&<p>{p.none}</p>}{reports.map(r=><article className="surface-card space-y-3" key={r.id}><h2>{r.target_kind} · {p[r.reason]}</h2><p className="whitespace-pre-wrap">{r.detail}</p><time dateTime={r.created_at}>{new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short"}).format(new Date(r.created_at))}</time><p>{r.target_id}</p><div className="flex flex-wrap gap-3"><button className="button button-secondary" disabled={pending} onClick={()=>start(async()=>{const result=await loadReportContext(r.id);if("error"in result)setError(p[result.error]);else setContexts(v=>({...v,[r.id]:result.data??p.unavailable}));})}>{p.details}</button><button className="button" disabled={pending} onClick={()=>start(async()=>{const result=await safetyAction({action:"resolve",id:r.id});if("error"in result)setError(p[result.error]);else router.refresh();})}>{p.resolve}</button>{r.target_kind==="homework"&&<button className="button button-secondary" disabled={pending} onClick={()=>start(async()=>{const result=await moderateHomework(r.target_id);if("error"in result)setError(p[result.error]);else router.refresh();})}>{p.adminHide}</button>}</div>{contexts[r.id]&&<p className="whitespace-pre-wrap">{contexts[r.id]}</p>}</article>)}</div>;
}
