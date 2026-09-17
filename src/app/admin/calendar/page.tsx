import Link from "next/link";
import {requireAdmin} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {getNonSchoolDays} from "@/lib/calendar-queries";
import {v05Copy} from "@/lib/v05-copy";
import {SiteShell} from "@/components/site-shell";
import {PageIntro} from "@/components/ui";
import {ActionForm} from "@/components/action-form";
import {Field} from "@/components/fields";
import {saveNonSchoolDay,deleteNonSchoolDay} from "@/app/actions/calendar";
export default async function CalendarPage(){
 await requireAdmin();const {locale}=await getI18n(),t=v05Copy(locale),days=await getNonSchoolDays();
 return <SiteShell><Link className="text-link" href="/admin">{t.dashboard}</Link><PageIntro title={t.calendar}/>
 <div className="mt-8 grid gap-8 lg:grid-cols-2"><ActionForm action={saveNonSchoolDay} label={t.add}>
 <Field type="date" name="start_date" label={t.from} required/><Field type="date" name="end_date" label={t.to} required/>
 <label className="block"><span className="field-label">{t.type}</span><select className="field" name="type">{Object.entries(t.dayTypes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 <Field name="label" label={t.reason} required maxLength={160}/>
 </ActionForm><ul className="space-y-4">{days.sort((a,b)=>a.start_date.localeCompare(b.start_date)).map(day=><li key={day.id} className="surface-card">
 <h2 className="font-semibold">{day.label}</h2><p>{day.start_date} — {day.end_date} · {t.dayTypes[day.type]}</p>
 <details className="mt-4"><summary>{t.remove}</summary><ActionForm action={deleteNonSchoolDay} label={t.remove}>
 <input type="hidden" name="id" value={day.id}/><label className="flex gap-3"><input type="checkbox" name="confirm" required/>{t.confirm}</label>
 </ActionForm></details></li>)}</ul></div></SiteShell>;
}
