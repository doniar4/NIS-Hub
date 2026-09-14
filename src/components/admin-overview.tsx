import Link from "next/link";
import {database} from "@/lib/queries";
import {getI18n} from "@/lib/i18n-server";
import {v05Copy} from "@/lib/v05-copy";
import {SiteShell} from "./site-shell";
import {PageIntro} from "./ui";
export async function AdminOverview(){
 const {locale}=await getI18n(),t=v05Copy(locale),db=await database();
 const {data:recent,error}=await db.from("schedule_import_batches").select("id,created_at,source_type,row_count").order("created_at",{ascending:false}).limit(5);
 const [open,unread]=await Promise.all([db.from("support_tickets").select("id",{count:"exact",head:true}).in("status",["open","in_progress"]),db.from("support_tickets").select("id",{count:"exact",head:true}).in("status",["open","in_progress"]).eq("needs_admin_reply",true)]);
 if(open.error||unread.error)throw new Error("Ticket summary unavailable");
 if(error)throw new Error("Schedule history unavailable");
 return <SiteShell><PageIntro kicker="Admin" title={t.dashboard}>{t.dashboardHint}</PageIntro>
 <p className="my-5"><Link className="text-link" href="/admin/tickets">{t.openCount}: {open.count??0} · {t.unread}: {unread.count??0}</Link></p>
 <nav aria-label={t.dashboard} className="my-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 {[[t.books,"/admin?entity=books"],[t.schedule,"/admin?entity=schedule"],[t.imports,"/admin?entity=schedule#import"],[t.versions,"/admin/versions"],[t.calendar,"/admin/calendar"],[t.catalog,"/admin?entity=classes"],[t.support,"/admin/tickets"]].map(([label,href])=><Link key={href} className="dashboard-card" href={href}>{label}<span aria-hidden="true">↗</span></Link>)}
 </nav><section className="surface-card"><h2 className="section-title">{t.recent}</h2><ul>{recent.map(row=><li className="py-3" key={row.id}><Link className="text-link" href={"/admin/versions?id="+row.id}>{row.created_at.slice(0,16).replace("T"," ")} · {row.source_type} · {row.row_count}</Link></li>)}</ul></section>
 </SiteShell>;
}
