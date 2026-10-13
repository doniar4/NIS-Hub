import type {Locale} from "@/lib/i18n";
import {requireAdmin} from "@/lib/auth";
import {database} from "@/lib/queries";
import {adminSystemConfig} from "@/lib/admin-system";
import {controlCopy,adminTime} from "@/lib/admin-control";
import {AdminWidget} from "./admin-data-ui";
export function AdminSystemConfiguration({locale}:{locale:Locale}){
 const config=adminSystemConfig(),t=controlCopy(locale);
 return <><AdminWidget title={t.health}><p>{t.configuration}</p><ul className="admin-list">{config.services.map(s=><li key={s.name}><strong>{s.name}</strong><p>{s.configured?t.configured:t.missing}</p></li>)}</ul></AdminWidget><AdminWidget title={t.version}><dl><dt>NIS Hub</dt><dd>{config.version}</dd><dt>{t.commit}</dt><dd>{config.commit??t.unknown}</dd><dt>{t.built}</dt><dd>{config.built?adminTime(config.built,locale):t.unknown}</dd></dl></AdminWidget><AdminWidget title={t.errorsToday}><p>{t.telemetry}</p></AdminWidget><AdminWidget title={t.performance}><p>{t.noMetrics}</p></AdminWidget></>;
}
export async function AdminDatabaseHealth({locale}:{locale:Locale}){
 await requireAdmin();const t=controlCopy(locale);let healthy=false;
 try{const db=await database(),{error}=await db.from("classes").select("id").limit(1).abortSignal(AbortSignal.timeout(5000));healthy=!error;}catch{healthy=false;}
 return <AdminWidget title="Supabase / Database"><p role="status">{healthy?t.reachable:t.failed}</p></AdminWidget>;
}
