import Link from "next/link";
import {notFound} from "next/navigation";
import {requireAdmin} from "@/lib/auth";
import {database,getCatalogOptions} from "@/lib/queries";
import {getI18n} from "@/lib/i18n-server";
import {v05Copy} from "@/lib/v05-copy";
import {uuid} from "@/lib/validation";
import type {LessonSnapshot} from "@/lib/schedule-diff";
import {SiteShell} from "@/components/site-shell";
import {PageIntro} from "@/components/ui";
import {ActionForm} from "@/components/action-form";
import {ScheduleDiff} from "@/components/schedule-diff";
import {restoreSchedule} from "@/app/actions/calendar";
export default async function VersionsPage({searchParams}:{searchParams:Promise<{id?:string;page?:string}>}){
 await requireAdmin();const params=await searchParams,{locale}=await getI18n(),t=v05Copy(locale),db=await database(),options=await getCatalogOptions();
 if(params.id&&!uuid.safeParse(params.id).success)notFound();
 const page=Number(params.page??0);if(!Number.isInteger(page)||page<0||page>10000)notFound();
 const [list,active]=await Promise.all([db.from("schedule_import_batches").select("id,created_at,source_type,row_count,status,note").order("created_at",{ascending:false}).order("id").range(page*100,page*100+99),
 db.from("schedule_import_batches").select("*").eq("status","active").single()]);
 if(list.error||active.error)throw new Error("Schedule history unavailable");
 const selected=params.id?await db.from("schedule_import_batches").select("*").eq("id",params.id).maybeSingle():{data:active.data,error:null};
 if(selected.error)throw new Error("Schedule history unavailable");if(!selected.data)notFound();
 const version=selected.data,previous=version.previous_id?await db.from("schedule_import_batches").select("snapshot").eq("id",version.previous_id).single():{data:null,error:null};
 if(previous.error)throw new Error("Schedule history unavailable");
 return <SiteShell><Link href="/admin" className="text-link">{t.dashboard}</Link><PageIntro title={t.versions}/>
 <div className="my-8 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]"><nav aria-label={t.versions}><p className="text-sm">{t.scope}</p><ul className="divide-y divide-[var(--line)]">{list.data.map(row=><li key={row.id} className="py-4"><Link className="text-link" aria-current={version.id===row.id?"page":undefined} href={"/admin/versions?id="+row.id+"&page="+page}>{row.created_at.slice(0,19).replace("T"," ")} · {row.source_type}</Link><p className="text-sm">{row.row_count} · {row.status==="active"?t.active:t.historical}</p></li>)}</ul>
 <div className="flex gap-4">{page>0&&<Link href="/admin/versions" className="text-link">{t.newer}</Link>}{list.data.length===100&&<Link href={"/admin/versions?page="+(page+1)} className="text-link">{t.older}</Link>}</div></nav>
 <section className="surface-card min-w-0"><h2 className="section-title">{t.compare}</h2><p className="my-3 break-words">{version.note}</p>
 <ScheduleDiff before={(previous.data?.snapshot??[]) as LessonSnapshot[]} after={version.snapshot as LessonSnapshot[]} {...options} locale={locale}/>
 {version.id!==active.data.id && <div className="mt-8 border-t border-[var(--line)] pt-6"><h2 className="section-title">{t.restoreCompare}</h2>
 <ScheduleDiff before={active.data.snapshot as LessonSnapshot[]} after={version.snapshot as LessonSnapshot[]} {...options} locale={locale}/>
 <ActionForm action={restoreSchedule} label={t.restore}><p>{t.restoreHint}</p><input type="hidden" name="id" value={version.id}/><input type="hidden" name="active" value={active.data.id}/><label className="flex gap-3"><input type="checkbox" name="confirm" required/>{t.confirm}</label></ActionForm></div>}
 </section></div></SiteShell>;
}
