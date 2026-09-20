"use client";
import { useState,useTransition } from "react";
import { reviewStudyAnswers } from "@/app/actions/study-answers";
import { selfCheckQuestions,type AnswerReviewResult } from "@/lib/study-answer-review";
import type { StudyResponse } from "@/lib/ai-study";
import { v053Copy } from "@/lib/v053-copy";
import { v051Copy } from "@/lib/v051-copy";
import { useI18n } from "./locale-provider";
export function StudyAnswerForm({generationId,response}:{generationId:string;response:StudyResponse}){
 const {locale,t}=useI18n(),p=v053Copy(locale),a=v051Copy(locale),questions=selfCheckQuestions(response);
 const [answers,setAnswers]=useState<Record<number,string>>({}),[result,setResult]=useState<AnswerReviewResult|null>(null),[pending,start]=useTransition();
 if(!questions.length)return null;
 return <form className="study-answer-form space-y-4" onSubmit={e=>{e.preventDefault();setResult(null);const values=Object.entries(answers).filter(([,text])=>text.trim()).map(([index,text])=>({index:Number(index),text}));start(async()=>{try{setResult(await reviewStudyAnswers({generationId,answers:values}));}catch{setResult({error:"failed"});}});}}>
 <p>{p.reviewHint}</p><fieldset disabled={pending} className="space-y-4">{questions.map((q,index)=><label key={index} className="block"><span className="field-label">{index+1}. {q.text}</span><textarea className="field" aria-label={p.answer+" "+(index+1)} rows={3} maxLength={1000} value={answers[index]??""} onChange={e=>{setAnswers(v=>({...v,[index]:e.target.value}));setResult(null);}}/></label>)}
 <button className="button" disabled={!Object.values(answers).some(v=>v.trim())}>{pending?a.working:p.reviewAnswers}</button></fieldset>
 {pending&&<p role="status">{a.working}</p>}{result?.error&&<p role="alert">{result.error==="quota"?a.quota:result.error==="provider_quota"?a.aiProviderQuota:result.error==="timeout"?a.aiTimeout:result.error==="unavailable"?a.unavailable:result.error==="configuration"?a.aiConfiguration:result.error==="busy"?a.aiBusy:a.aiError}</p>}
 {result?.response&&<section className="space-y-3" aria-label={p.reviewAnswers}><p>{a.source}: {t.pages} {result.source?.start}–{result.source?.end}</p>{result.response.feedback.map(f=><article key={f.index}><h4>{f.index+1}. {p[f.status]}</h4><p>{f.feedback}</p>{f.evidence.map((e,i)=><blockquote key={i}>{e.quote}<cite> · {t.page} {e.page}</cite></blockquote>)}</article>)}<h4>{p.topics}</h4><ul>{result.response.topicsToReview.map((topic,i)=><li key={i}>{topic.text}{topic.evidence.map((e,n)=><blockquote key={n}>{e.quote}<cite> · {t.page} {e.page}</cite></blockquote>)}</li>)}</ul></section>}
 </form>;
}
