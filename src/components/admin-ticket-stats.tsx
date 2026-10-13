import type {Locale} from "@/lib/i18n";
import {controlCopy} from "@/lib/admin-control";
import {adminData} from "@/lib/admin-queries";
import {AdminStat,AdminUnavailable} from "./admin-data-ui";
export async function AdminTicketStats({locale}:{locale:Locale}){const t=controlCopy(locale),stats=await adminData("tickets");return stats?<div className="admin-stats"><AdminStat label={t.openTickets} value={stats.open}/><AdminStat label={t.unread} value={stats.waiting}/><AdminStat label={t.resolved} value={stats.resolved} hint={t.resolvedHint}/></div>:<AdminUnavailable locale={locale}/>;}
