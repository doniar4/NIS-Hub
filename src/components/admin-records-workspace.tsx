import {randomUUID} from "node:crypto";
import Link from "next/link";
import {notFound} from "next/navigation";
import {requireAdmin} from "@/lib/auth";
import {database,getCatalogOptions} from "@/lib/queries";
import {uuid} from "@/lib/validation";
import {getI18n} from "@/lib/i18n-server";
import {adminCopy} from "@/lib/admin-copy";
import {controlCopy,adminPage} from "@/lib/admin-control";
import {phase4Copy} from "@/lib/phase4-copy";
import {v05Copy} from "@/lib/v05-copy";
import {subjectName} from "@/lib/i18n";
import {saveBook} from "@/app/actions/books";
import {saveAdminRecord,deleteAdminRecord} from "@/app/actions/admin";
import {BookEditor} from "./book-editor";
import {ActionForm} from "./action-form";
import {Field} from "./fields";
import {AdminFilterForm} from "./admin-filter-form";
export type RecordParams={id?:string;q?:string;subject?:string;grade?:string;status?:string;page?:string};
export async function AdminRecordsWorkspace({entity,params}:{entity:"books"|"classes"|"subjects";params:RecordParams}){
 await requireAdmin();
 const [{locale},db,{classes,subjects}]=await Promise.all([getI18n(),database(),getCatalogOptions()]);
 const a=adminCopy(locale),t=controlCopy(locale),p=phase4Copy(locale),v=v05Copy(locale),page=adminPage(params.page),size=25;
 const href=entity==="books"?"/admin/content":entity==="classes"?"/admin/schedule/classes":"/admin/content/subjects";
 if(params.id&&!uuid.safeParse(params.id).success)notFound();
 const q=(params.q??"").trim().slice(0,100),subjectId=uuid.safeParse(params.subject).success?params.subject:undefined;
 const grade=Number(params.grade),status=["draft","published","archived"].includes(params.status??"")?params.status as "draft"|"published"|"archived":undefined;
 let query=db.from("books").select("*",{count:"exact"}).order("title").order("id").range(page*size,page*size+size-1);
 if(q)query=query.ilike("title","%"+q.replace(/[\\%_]/g,"\\$&")+"%");
 if(subjectId)query=query.eq("subject_id",subjectId);
 if(Number.isInteger(grade)&&grade>=1&&grade<=12)query=query.eq("grade",grade);
 if(status)query=query.eq("publication_status",status);
 const [list,selected,variants]=await Promise.all([
  entity==="books"?query:Promise.resolve({data:[],error:null,count:0}),
  entity==="books"&&params.id?db.from("books").select("*").eq("id",params.id).maybeSingle():Promise.resolve({data:null,error:null}),
  entity==="books"&&params.id?db.from("book_variants").select("*").eq("book_id",params.id).order("created_at"):Promise.resolve({data:[],error:null}),
 ]);
 if(list.error||selected.error||variants.error)throw new Error(p.bookError);
 const book=selected.data??undefined,classRow=entity==="classes"?classes.find(c=>c.id===params.id):undefined,subject=entity==="subjects"?subjects.find(s=>s.id===params.id):undefined,record=book??classRow??subject;
 if(params.id&&!record)notFound();
 const allRows=entity==="books"?(list.data??[]).map(b=>({id:b.id,name:b.title,detail:p[b.publication_status]})):entity==="classes"?classes.map(c=>({id:c.id,name:c.name,detail:""})):subjects.filter(s=>!q||[s.name,s.name_ru,s.name_kz,s.name_en].some(n=>n?.toLocaleLowerCase().includes(q.toLocaleLowerCase()))).map(s=>({id:s.id,name:subjectName(s,locale),detail:""}));
 const rows=entity==="books"?allRows:allRows.slice(page*size,(page+1)*size),total=entity==="books"?list.count??0:allRows.length;
 const filters=new URLSearchParams();for(const [k,val] of Object.entries({q,subject:subjectId,grade:params.grade,status,page:String(page)}))if(val)filters.set(k,val);
 const pageHref=(n:number)=>{const f=new URLSearchParams(filters);f.set("page",String(n));return href+"?"+f;};
 return <>
  {entity!=="classes"&&<AdminFilterForm href={href} key={JSON.stringify(params)}><Field name="q" label={entity==="books"?t.bookSearch:t.subjects} maxLength={100} defaultValue={q}/>{entity==="books"&&<>
   <label><span className="field-label">{t.subjects}</span><select className="field" name="subject" defaultValue={subjectId??""}><option value="">{t.all}</option>{subjects.map(s=><option key={s.id} value={s.id}>{subjectName(s,locale)}</option>)}</select></label>
   <label><span className="field-label">{t.grade}</span><select className="field" name="grade" defaultValue={params.grade??""}><option value="">{t.all}</option>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
   <label><span className="field-label">{t.publication}</span><select className="field" name="status" defaultValue={status??""}><option value="">{t.all}</option>{(["draft","published","archived"] as const).map(key=><option key={key} value={key}>{p[key]}</option>)}</select></label>
  </>}</AdminFilterForm>}
  <div className="admin-workspace mt-5">
   <section className="surface-card admin-records"><div className="admin-list-header"><h2 className="section-title">{a.records} · {total}</h2><Link href={href} className="text-link">{a.create}</Link></div>
    <ul className="admin-list">{rows.map(row=><li key={row.id}><Link prefetch={false} aria-current={params.id===row.id?"page":undefined} className="text-link break-words" href={href+"?"+filters+"&id="+row.id}>{row.name}</Link>{row.detail&&<p className="admin-muted">{row.detail}</p>}</li>)}</ul>{!rows.length&&<p>{t.empty}</p>}
    <div className="admin-pagination">{page>0&&<Link href={pageHref(page-1)} className="text-link">{t.previous}</Link>}<span>{t.page} {page+1}</span>{(page+1)*size<total&&page<400&&<Link href={pageHref(page+1)} className="text-link">{t.next}</Link>}</div>
   </section>
   <section className="surface-card admin-editor" key={entity+(params.id??"new")}><h2 className="section-title mb-6">{record?a.edit:a.new}</h2>
    {entity==="books"&&<BookEditor id={book?.id??randomUUID()} book={book} variants={variants.data??[]} classes={classes} subjects={subjects} action={saveBook}/>}
    {entity!=="books"&&<ActionForm action={saveAdminRecord} label={a.save}><input type="hidden" name="entity" value={entity}/><input type="hidden" name="id" value={params.id??""}/>
     {entity==="classes"?<><Field label={a.className} name="name" required maxLength={40} defaultValue={classRow?.name??""}/><Field label={a.grade} name="grade" type="number" min={1} max={12} defaultValue={classRow?.grade??""}/><Field label={a.section} name="section" maxLength={10} defaultValue={classRow?.section??""}/></>:<>
      <Field label={a.subjectName} name="name" required maxLength={100} defaultValue={subject?.name??""}/><Field label="Русский" name="name_ru" required maxLength={100} defaultValue={subject?.name_ru??subject?.name??""}/><Field label={a.kazakh} name="name_kz" required maxLength={100} defaultValue={subject?.name_kz??""}/><Field label={a.english} name="name_en" required maxLength={100} defaultValue={subject?.name_en??""}/><Field label={a.short} name="short_name" maxLength={30} defaultValue={subject?.short_name??""}/>
     </>}
    </ActionForm>}
    {record&&<div className="mt-8 border-t border-[var(--line)] pt-6"><ActionForm action={deleteAdminRecord} label={entity==="books"?a.archive:v.remove}><input type="hidden" name="entity" value={entity}/><input type="hidden" name="id" value={record.id}/><p className="admin-muted">{entity==="books"?a.archiveHint:a.deleteHint}</p><label className="flex gap-3"><input type="checkbox" name="confirm_delete" required/>{v.confirm}</label></ActionForm></div>}
   </section>
  </div>
 </>;
}
