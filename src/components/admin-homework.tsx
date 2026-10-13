import Link from "next/link";
import {z} from "zod";
import {getCatalogOptions} from "@/lib/queries";
import {adminData} from "@/lib/admin-queries";
import {controlCopy,adminPage,adminTime} from "@/lib/admin-control";
import type {Locale} from "@/lib/i18n";
import {subjectName} from "@/lib/i18n";
import {uuid} from "@/lib/validation";
import {hideAdminHomework} from "@/app/actions/admin-control";
import {AdminFilterForm} from "./admin-filter-form";
import {Field} from "./fields";
import {ActionForm} from "./action-form";
import {AdminStat,AdminUnavailable,AdminPagination} from "./admin-data-ui";
export type HomeworkParams={class?:string;subject?:string;due?:string;status?:string;source?:string;page?:string};
export function homeworkFilters(p:HomeworkParams){return {class:uuid.safeParse(p.class).success?p.class:undefined,subject:uuid.safeParse(p.subject).success?p.subject:undefined,due:z.iso.date().safeParse(p.due).success?p.due:undefined,status:["visible","hidden"].includes(p.status??"")?p.status:undefined,source:["telegram","unknown"].includes(p.source??"")?p.source:undefined};}
export async function HomeworkFilters({locale,params}:{locale:Locale;params:HomeworkParams}){
 const {classes,subjects}=await getCatalogOptions(),t=controlCopy(locale),p=homeworkFilters(params);
 return <AdminFilterForm href="/admin/homework" key={JSON.stringify(p)}>{[["class",t.classes,classes.map(c=>({id:c.id,name:c.name}))],["subject",t.subjects,subjects.map(s=>({id:s.id,name:subjectName(s,locale)}))]].map(([name,label,options])=><label key={name as string}><span className="field-label">{label as string}</span><select className="field" name={name as string} defaultValue={p[name as "class"|"subject"]??""}><option value="">{t.all}</option>{(options as {id:string;name:string}[]).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>)}<Field name="due" label={t.due} type="date" defaultValue={p.due??""}/><label><span className="field-label">{t.moderationStatus}</span><select className="field" name="status" defaultValue={p.status??""}><option value="">{t.all}</option><option value="visible">{t.visible}</option><option value="hidden">{t.hidden}</option></select></label><label><span className="field-label">{t.source}</span><select className="field" name="source" defaultValue={p.source??""}><option value="">{t.all}</option><option value="telegram">{t.telegram}</option><option value="unknown">{t.sourceUnknown}</option></select></label></AdminFilterForm>;
}
export async function HomeworkStats({locale}:{locale:Locale}){const data=await adminData("homeworkStats"),t=controlCopy(locale);if(!data)return <AdminUnavailable locale={locale}/>;return <div className="admin-stats">{([["today",t.homeworkToday],["week",t.addedWeek],["telegram",t.telegram],["authors",t.authors],["visible",t.visible],["hidden",t.hidden]] as const).map(([key,label])=><AdminStat key={key} label={label} value={data[key]} hint={key==="authors"?t.authorHint:undefined}/>)}</div>;}
export async function HomeworkResults({locale,params}:{locale:Locale;params:HomeworkParams}){
 const p=homeworkFilters(params),page=adminPage(params.page),[data,options]=await Promise.all([adminData("homework",{...p,offset:page*25}),getCatalogOptions()]),t=controlCopy(locale);
 if(!data)return <AdminUnavailable locale={locale}/>;const classes=new Map(options.classes.map(c=>[c.id,c.name])),subjects=new Map(options.subjects.map(s=>[s.id,s]));
 return <section className="surface-card"><p className="admin-muted">{t.sourceHint}</p><p className="admin-muted my-3">{t.hideHint}</p><ul className="admin-list">{data.rows.map(row=><li key={row.id}><div className="admin-list-header"><strong>{classes.get(row.class_id)??t.noClass} · {subjectName(subjects.get(row.subject_id),locale)}</strong><time dateTime={row.due_date}>{row.due_date}</time></div><p className="admin-muted">{t[row.moderation_status]} · {row.telegram?t.telegram:t.sourceUnknown} · {adminTime(row.created_at,locale)}</p><details className="my-3"><summary>{t.body}</summary><p className="admin-homework-body">{row.body}</p></details><p className="admin-homework-body line-clamp-2">{row.body}</p>{row.moderation_status==="visible"&&<details className="mt-3"><summary>{t.hide}</summary><ActionForm action={hideAdminHomework} label={t.hide}><input type="hidden" name="id" value={row.id}/><label className="flex gap-3"><input type="checkbox" name="confirm" required/>{t.confirmHide}</label></ActionForm></details>}</li>)}</ul>{!data.rows.length&&<p>{t.empty}</p>}<AdminPagination href="/admin/homework" params={p} page={page} total={data.total}/><Link href="/schedule" className="text-link">{t.addHomework}</Link></section>;
}
