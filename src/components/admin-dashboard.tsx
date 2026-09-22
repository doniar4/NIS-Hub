import Link from "next/link";
import type {Locale} from "@/lib/i18n";
import {adminCopy} from "@/lib/admin-copy";
import {v05Copy} from "@/lib/v05-copy";
import {PageIntro} from "./ui";
export function AdminDashboard({locale,open,unread,recent}:{locale:Locale;open:number;unread:number;recent:{id:string;created_at:string;source_type:string;row_count:number}[]}){
 const t=v05Copy(locale);
 return <><PageIntro kicker="Admin" title={t.dashboard}>{t.dashboardHint}</PageIntro>
 <p className="my-5"><Link className="text-link" href="/admin/tickets">{t.openCount}: {open} · {t.unread}: {unread}</Link></p>
 <nav aria-label={t.dashboard} className="my-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 {[[t.books,"/admin?entity=books"],[t.schedule,"/admin?entity=schedule"],[t.imports,"/admin?entity=schedule#import"],[t.versions,"/admin/versions"],[t.calendar,"/admin/calendar"],[adminCopy(locale).classes,"/admin?entity=classes"],[adminCopy(locale).subjects,"/admin?entity=subjects"],[t.support,"/admin/tickets"]].map(([label,href])=><Link key={href} className="dashboard-card" href={href}>{label}<span aria-hidden="true">↗</span></Link>)}
 </nav><section className="surface-card"><h2 className="section-title">{t.recent}</h2><ul>{recent.map(row=><li className="py-3" key={row.id}><Link className="text-link" href={"/admin/versions?id="+row.id}>{row.created_at.slice(0,16).replace("T"," ")} UTC · {row.source_type} · {row.row_count}</Link></li>)}</ul></section></>;
}
