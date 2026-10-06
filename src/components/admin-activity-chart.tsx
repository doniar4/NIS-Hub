"use client";
import {useRef,useState,useTransition} from "react";
import {loadAdminChart} from "@/app/actions/admin-control";
import {controlCopy} from "@/lib/admin-control";
import type {ChartPoint} from "@/lib/admin-types";
import {useI18n} from "./locale-provider";
import {AdminSkeleton} from "./admin-loading";
type Range="24h"|"7d"|"30d";
export function AdminActivityChart({initial}:{initial:ChartPoint[]|null}){
 const {locale}=useI18n(),t=controlCopy(locale),[range,setRange]=useState<Range>("24h"),[results,setResults]=useState<Partial<Record<Range,ChartPoint[]|null>>>({"24h":initial}),[pending,start]=useTransition();
 const [initialAt]=useState(()=>Date.now());
 const cache=useRef<Partial<Record<Range,{at:number;data:ChartPoint[]|null}>>>({"24h":{at:initialAt,data:initial}}),request=useRef(0);
 const points=results[range],max=Math.max(1,...(points??[]).map(p=>p.count));
 function select(next:Range,now:number){setRange(next);const known=cache.current[next];if(known&&now-known.at<30000){setResults(r=>({...r,[next]:known.data}));return;}const revision=++request.current;
  start(async()=>{const result=await loadAdminChart(next),data="data" in result?result.data:null;cache.current[next]={at:now,data};if(revision===request.current)setResults(r=>({...r,[next]:data}));});
 }
 return <section className="surface-card admin-widget"><h2>{t.chart}</h2><div className="admin-chart-range" role="group" aria-label={t.chart}>{(["24h","7d","30d"] as const).map(key=><button type="button" className="button button-secondary" aria-pressed={range===key} key={key} onClick={()=>select(key,Date.now())}>{key}</button>)}</div><p className="mt-3">{t.chartHint}</p>
  <div aria-busy={pending}>{points===undefined?<AdminSkeleton locale={locale} compact/>:points===null?<p role="status">{t.unavailable}</p>:<><div className="admin-chart" aria-hidden>{points.map(p=><div key={p.at} className="admin-chart-bar" title={(p.label??p.at)+": "+p.count}><span style={{height:Math.max(1,p.count/max*100)+"%"}}/></div>)}</div><details className="mt-3"><summary>{t.detail}</summary><ul className="admin-list">{points.map(p=><li key={p.at}><time dateTime={p.at}>{p.label??p.at}</time> · {p.count}</li>)}</ul></details></>}</div>
 </section>;
}
