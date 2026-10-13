"use client";
import {useState} from "react";
import {deleteAdminRecord} from "@/app/actions/admin";
import {v05Copy} from "@/lib/v05-copy";
import {phase4Copy} from "@/lib/phase4-copy";
import {controlCopy} from "@/lib/admin-control";
import {useI18n} from "./locale-provider";
import {ActionForm} from "./action-form";
export function AdminLessonRemoval({entries,classes,initialClass}:{entries:{id:string;class_id:string;label:string}[];classes:{id:string;name:string}[];initialClass:string}){
 const {locale}=useI18n(),t=v05Copy(locale),p=phase4Copy(locale),c=controlCopy(locale),[open,setOpen]=useState(false),[classId,setClassId]=useState(initialClass),[lessonId,setLessonId]=useState("");
 const rows=entries.filter(l=>l.class_id===classId),selected=rows.find(l=>l.id===lessonId)??rows[0];
 return <details className="surface-card mt-5" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{t.remove}</summary>{open&&<div className="space-y-4 mt-4"><p className="admin-muted">{p.csvHint}</p><label><span className="field-label">{c.classes}</span><select className="field" value={classId} onChange={e=>{setClassId(e.target.value);setLessonId("");}}>{classes.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>{selected?<><label><span className="field-label">{c.schedule}</span><select className="field" value={selected.id} onChange={e=>setLessonId(e.target.value)}>{rows.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label><ActionForm key={selected.id} action={deleteAdminRecord} label={t.remove}><input type="hidden" name="entity" value="schedule"/><input type="hidden" name="id" value={selected.id}/><p>{t.restoreHint}</p><label className="flex gap-3"><input type="checkbox" name="confirm_delete" required/>{t.confirm}</label></ActionForm></>:<p>{c.empty}</p>}</div>}</details>;
}
