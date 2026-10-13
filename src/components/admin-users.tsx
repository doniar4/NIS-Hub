import Link from "next/link";
import {getCatalogOptions} from "@/lib/queries";
import {adminData} from "@/lib/admin-queries";
import {controlCopy,adminPage} from "@/lib/admin-control";
import type {Locale} from "@/lib/i18n";
import {uuid} from "@/lib/validation";
import {AdminFilterForm} from "./admin-filter-form";
import {AdminUserList,AdminUnavailable,AdminPagination} from "./admin-data-ui";
import {Field} from "./fields";
export type UserParams={q?:string;class?:string;role?:string;active?:string;page?:string};
export function userFilters(params:UserParams){return {q:(params.q??"").trim().slice(0,60),class:uuid.safeParse(params.class).success?params.class:undefined,role:["student","admin"].includes(params.role??"")?params.role:undefined,active:["online","today","week"].includes(params.active??"")?params.active:undefined};}
export async function AdminUsersFilters({locale,params}:{locale:Locale;params:UserParams}){
 const {classes}=await getCatalogOptions(),t=controlCopy(locale),p=userFilters(params);
 return <AdminFilterForm href="/admin/users" key={JSON.stringify(p)}><Field name="q" label={t.search} defaultValue={p.q} maxLength={60}/><label><span className="field-label">{t.classes}</span><select className="field" name="class" defaultValue={p.class??""}><option value="">{t.all}</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label><span className="field-label">{t.role}</span><select className="field" name="role" defaultValue={p.role??""}><option value="">{t.all}</option><option value="student">{t.student}</option><option value="admin">{t.admin}</option></select></label><label><span className="field-label">{t.activity}</span><select className="field" name="active" defaultValue={p.active??""}><option value="">{t.all}</option><option value="online">{t.online}</option><option value="today">{t.today}</option><option value="week">{t.week}</option></select></label></AdminFilterForm>;
}
export async function AdminUsersResults({locale,params}:{locale:Locale;params:UserParams}){
 const page=adminPage(params.page),filters=userFilters(params),data=await adminData("users",{...filters,offset:page*25});if(!data)return <AdminUnavailable locale={locale}/>;
 return <section className="surface-card"><p className="admin-muted">{controlCopy(locale).totalUsers}: {data.total}</p><AdminUserList rows={data.rows} locale={locale}/><AdminPagination href="/admin/users" params={filters} page={page} total={data.total}/><Link className="text-link" href="/admin/users">{controlCopy(locale).recentUsers}</Link></section>;
}
