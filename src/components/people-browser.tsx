"use client";
import Link from "next/link";
import type { SubjectRow } from "@/lib/database.types";
import { SubjectBadges } from "./subject-badges";
import { SafetyMenu } from "./safety-menu";
import { useState, useTransition } from "react";
import { findPeople } from "@/app/actions/people";
import { v053Copy } from "@/lib/v053-copy";
import type { Person, PeopleScope, CommunityError } from "@/lib/people";
import { useI18n } from "./locale-provider";
export function PeopleBrowser({initial=[],scope="search",subjects=[]}:{initial?:Person[];scope?:PeopleScope;subjects?:SubjectRow[]}){
 const {locale}=useI18n(),p=v053Copy(locale);
 const [query,setQuery]=useState(""),[rows,setRows]=useState(initial),[error,setError]=useState<CommunityError|null>(null),[offset,setOffset]=useState(0),[pending,start]=useTransition();
 function load(next=0){start(async()=>{const result=await findPeople(scope,query,undefined,next);if("error"in result)setError(result.error);else{setRows(result.data);setOffset(next);setError(null);}});}
 return <section className="space-y-5">
 {scope==="search"&&<form className="flex flex-wrap gap-3 items-end" onSubmit={e=>{e.preventDefault();load();}}><label className="min-w-0 flex-1"><span className="field-label">{p.search}</span><input className="field" minLength={2} maxLength={60} required value={query} onChange={e=>setQuery(e.target.value)} aria-describedby="people-hint"/></label><button className="button" disabled={pending}>{p.search}</button><p id="people-hint" className="w-full text-sm">{p.searchHint}</p></form>}
 {error&&<p role="alert">{p[error]}</p>}
 <ul className="people-grid" aria-busy={pending}>{rows.map(person=><li key={person.id}><Link prefetch={false} className="surface-card person-card" href={"/people/"+person.id}><span className="conversation-initial" aria-hidden="true">{Array.from(person.display_name)[0]}</span><h2 className="section-title">{person.display_name}</h2>{person.bio&&<p className="preview-lines">{person.bio}</p>}<SubjectBadges ids={person.top_subjects} subjects={subjects} locale={locale}/>{person.relationship!=="none"&&<span>{p[person.relationship]}</span>}</Link>{scope==="blocked"&&<SafetyMenu peer={person.id} blocked onDone={()=>load(offset)}/>}</li>)}</ul>
 {!rows.length&&!error&&<p role="status">{p.none}</p>}
 <div className="flex flex-wrap gap-3"><button className="button button-secondary" disabled={pending||offset===0} onClick={()=>load(Math.max(0,offset-12))}>{p.previous}</button><button className="button button-secondary" disabled={pending||rows.length<12||offset>=9996} onClick={()=>load(offset+12)}>{p.more}</button></div>
 </section>;
}
