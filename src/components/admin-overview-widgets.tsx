import Link from "next/link";
import type {Locale} from "@/lib/i18n";
import {controlCopy,adminTime} from "@/lib/admin-control";
import {adminData} from "@/lib/admin-queries";
import {adminSystemConfig} from "@/lib/admin-system";
import {AdminStat,AdminWidget,AdminUnavailable,AdminFeed,AdminRegistrations} from "./admin-data-ui";
import {AdminActivityChart} from "./admin-activity-chart";
export async function OverviewStats({locale}:{locale:Locale}){
 const t=controlCopy(locale),stats=await adminData("stats");
 return <div className="admin-stats">{([["online","online"],["today","today"],["totalUsers","totalUsers"],["newUsers","newUsers"],["homeworkToday","homeworkToday"],["openTickets","openTickets"]] as const).map(([key,label])=><AdminStat key={key} label={t[label]} value={stats?.[key]??"—"}/>)}<AdminStat label={t.errorsToday} value="—" hint={t.telemetry}/><AdminStat label={t.status} value={adminSystemConfig().services.every(s=>s.configured)?"✓":"—"} hint={t.configuration}/>{!stats&&<AdminUnavailable locale={locale}/>}</div>;
}
export async function OverviewChart({locale}:{locale:Locale}){const points=await adminData("chart",{range:"24h"});return <AdminActivityChart key={locale} initial={points?.map(p=>({...p,label:adminTime(p.at,locale)}))??null}/>;}
export async function OverviewClasses({locale}:{locale:Locale}){
 const t=controlCopy(locale),rows=await adminData("classes");return <AdminWidget title={t.classActivity}>{rows?<><ul className="admin-list">{rows.slice(0,10).map(row=><li key={row.id}><Link className="text-link" href={"/admin/activity?class="+row.id}>{row.name}</Link><p>{t.registered}: {row.registered} · {t.today}: {row.active}</p></li>)}</ul>{!rows.length&&<p>{t.empty}</p>}<Link href="/admin/activity" className="text-link">{t.detail}</Link></>:<AdminUnavailable locale={locale}/>}</AdminWidget>;
}
export async function OverviewRegistrations({locale}:{locale:Locale}){return <AdminWidget title={controlCopy(locale).recentUsers}><AdminRegistrations locale={locale} rows={await adminData("registrations")}/></AdminWidget>;}
export async function OverviewFeed({locale}:{locale:Locale}){return <AdminWidget title={controlCopy(locale).recentActivity}><p>{controlCopy(locale).activityHint}</p><AdminFeed locale={locale} rows={(await adminData("feed",{},locale))?.slice(0,8)??null}/><Link className="text-link" href="/admin/activity">{controlCopy(locale).detail}</Link></AdminWidget>;}
export function OverviewHealth({locale}:{locale:Locale}){
 const t=controlCopy(locale);return <AdminWidget title={t.health}><ul className="admin-list">{adminSystemConfig().services.map(s=><li key={s.name}><strong>{s.name}</strong><p>{s.configured?t.configured:t.missing}</p></li>)}</ul><Link className="text-link" href="/admin/system">{t.detail}</Link></AdminWidget>;
}
