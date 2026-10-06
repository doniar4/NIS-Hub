import type {Locale} from "@/lib/i18n";
import {controlCopy} from "@/lib/admin-control";
import {PageIntro} from "./ui";
import {AdminStat} from "./admin-data-ui";
// Presentational fallback retained for existing isolated browser fixtures.
// Production Overview streams its independently guarded real-data widgets.
export function AdminDashboard({locale,open,unread}:{locale:Locale;open:number;unread:number;recent?:unknown[];activity?:unknown}){
 const t=controlCopy(locale);
 return <><PageIntro title={t.overview}/><div className="admin-stats"><AdminStat label={t.openTickets} value={open}/><AdminStat label={t.unread} value={unread}/><AdminStat label={t.errorsToday} value="—" hint={t.telemetry}/></div></>;
}
