"use client";
import { useRef,useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { safetyAction } from "@/app/actions/community-safety";
import { v053Copy } from "@/lib/v053-copy";
import type { CommunityError } from "@/lib/people";
import { useI18n } from "./locale-provider";
export function SafetyMenu({peer,thread,message,own=false,homework,blocked=false,onDone}:{peer?:string;thread?:string;message?:string;own?:boolean;homework?:string;blocked?:boolean;onDone?:()=>void}){
 const {locale}=useI18n(),p=v053Copy(locale),router=useRouter(),root=useRef<HTMLDetailsElement>(null);
 const [report,setReport]=useState(false),[error,setError]=useState<CommunityError|null>(null),[done,setDone]=useState(false),[pending,start]=useTransition();
 function act(input:unknown){start(async()=>{setError(null);setDone(false);const result=await safetyAction(input);if("error"in result)setError(result.error);else{setDone(true);setReport(false);if(root.current)root.current.open=false;window.dispatchEvent(new Event("nis-notifications-change"));onDone?.();router.refresh();}});}
 const target=message??homework??peer,kind=message?"message":homework?"homework":"profile";
 return <div className="safety-control"><details ref={root} className="safety-menu" onKeyDown={e=>{if(e.key==="Escape"&&root.current){root.current.open=false;root.current.querySelector("summary")?.focus();}}}><summary aria-label={p.safety} title={p.safety}>…</summary><div className="safety-options">
 {peer&&<button className="button button-secondary" disabled={pending} onClick={()=>act({action:blocked?"unblock":"block",id:peer})}>{blocked?p.unblock:p.block}</button>}
 {thread&&<><button className="button button-secondary" disabled={pending} onClick={()=>act({action:"hide",id:thread})}>{p.hide}</button><p className="text-sm">{p.hideHint}</p></>}
 {message&&own&&<button className="button button-secondary" disabled={pending} onClick={()=>act({action:"delete",id:message})}>{p.deleteOwn}</button>}
 {target&&!own&&!blocked&&<button className="button button-secondary" onClick={()=>setReport(v=>!v)}>{p.report}</button>}
 {report&&target&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);act({action:"report",id:target,kind,reason:f.get("reason"),detail:f.get("detail")});}}><label><span className="field-label">{p.reason}</span><select className="field" name="reason">{(["spam","harassment","privacy","other"]as const).map(k=><option key={k} value={k}>{p[k]}</option>)}</select></label><label><span className="field-label">{p.details}</span><textarea className="field" name="detail" rows={3} maxLength={500}/></label><button className="button" disabled={pending}>{p.report}</button></form>}
 </div></details>{error&&<p role="alert">{p[error]}</p>}{done&&<p role="status" className="text-sm">{p.sent}</p>}</div>;
}
