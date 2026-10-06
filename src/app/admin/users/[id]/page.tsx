import {Suspense} from "react";
import {notFound} from "next/navigation";
import Link from "next/link";
import {requireAdmin} from "@/lib/auth";
import {uuid} from "@/lib/validation";
import {adminData} from "@/lib/admin-queries";
import {getCatalogOptions} from "@/lib/queries";
import {controlCopy,adminTime} from "@/lib/admin-control";
import {getI18n} from "@/lib/i18n-server";
import type {Locale} from "@/lib/i18n";
import {updateAdminUser} from "@/app/actions/admin-control";
import {PageIntro} from "@/components/ui";
import {ActionForm} from "@/components/action-form";
import {AdminSkeleton} from "@/components/admin-loading";
import {AdminFeed,AdminUnavailable,AdminWidget} from "@/components/admin-data-ui";
async function UserDetail({id,locale}:{id:string;locale:Locale}){
 const [data,{classes}]=await Promise.all([adminData("users",{user:id}),getCatalogOptions()]),t=controlCopy(locale);
 if(!data)return <AdminUnavailable locale={locale}/>;const user=data.rows[0];if(!user)notFound();
 return <div className="admin-detail-grid"><AdminWidget title={user.display_name||t.unnamed}><dl>{[[t.classes,user.class_name||t.noClass],[t.role,t[user.role]],[t.created,adminTime(user.created_at,locale)],[t.lastActivity,adminTime(user.last_activity,locale)],[t.devices,user.device+" · "+user.browser]].map(([label,value])=><div key={label} className="contents"><dt>{label}</dt><dd>{value}</dd></div>)}</dl><Link className="text-link inline-block mt-4" href={"/people/"+id}>{t.publicProfile}</Link></AdminWidget><AdminWidget title={t.saveUser}><ActionForm action={updateAdminUser} label={t.saveUser}><input type="hidden" name="id" value={id}/><input type="hidden" name="expected" value={user.role}/><label><span className="field-label">{t.classes}</span><select className="field" name="class" defaultValue={user.class_id??""}><option value="">{t.noClass}</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label><span className="field-label">{t.role}</span><select className="field" name="role" defaultValue={user.role}><option value="student">{t.student}</option><option value="admin">{t.admin}</option></select></label><label className="flex gap-3"><input type="checkbox" name="confirm" required/>{t.confirmUser}</label><p>{t.lastAdmin}</p></ActionForm></AdminWidget></div>;
}
async function UserFeed({id,locale}:{id:string;locale:Locale}){return <AdminWidget title={controlCopy(locale).recentActivity}><AdminFeed rows={await adminData("feed",{user:id},locale)} locale={locale}/></AdminWidget>;}
export default async function UserPage({params}:{params:Promise<{id:string}>}){
 await requireAdmin();const [{id},{locale}]=await Promise.all([params,getI18n()]);if(!uuid.safeParse(id).success)notFound();
 return <><PageIntro title={controlCopy(locale).users}/><Link href="/admin/users" className="text-link">{controlCopy(locale).previous}</Link><div className="space-y-5 mt-5"><Suspense fallback={<AdminSkeleton locale={locale}/>}><UserDetail id={id} locale={locale}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale}/>}><UserFeed id={id} locale={locale}/></Suspense></div></>;
}
