import Link from "next/link";
import type {ReactNode} from "react";
import type {Locale} from "@/lib/i18n";
import {adminTime,controlCopy} from "@/lib/admin-control";
import type {AdminEvent,AdminUser,Registration} from "@/lib/admin-types";
import {AdminPaginationLinks} from "./admin-pagination";
export function AdminStat({label,value,hint}:{label:string;value:number|string;hint?:string}){return <dl className="surface-card admin-stat"><dt>{label}</dt><dd>{value}</dd>{hint&&<small>{hint}</small>}</dl>;}
export function AdminUnavailable({locale}:{locale:Locale}){return <p role="status" className="admin-muted">{controlCopy(locale).unavailable}</p>;}
export function AdminWidget({title,children}:{title:string;children:ReactNode}){return <section className="surface-card admin-widget"><h2>{title}</h2>{children}</section>;}
export function AdminFeed({rows,locale}:{rows:AdminEvent[]|null;locale:Locale}){
 const t=controlCopy(locale);if(!rows)return <AdminUnavailable locale={locale}/>;
 return rows.length?<ul className="admin-list">{rows.map(row=><li key={row.id}><div className="admin-list-header"><strong>{row.display_name||t.unnamed}</strong><time dateTime={row.created_at}>{adminTime(row.created_at,locale)}</time></div><p>{row.class_name||t.noClass} · {row.action}</p><p>{row.device} · {row.browser}</p></li>)}</ul>:<p>{t.empty}</p>;
}
export function AdminRegistrations({rows,locale}:{rows:Registration[]|null;locale:Locale}){
 const t=controlCopy(locale);if(!rows)return <AdminUnavailable locale={locale}/>;
 return rows.length?<ul className="admin-list">{rows.map(row=><li key={row.id}><Link prefetch={false} href={"/admin/users/"+row.id} className="text-link">{row.display_name||t.unnamed}</Link><p>{row.class_name||t.noClass} · <time dateTime={row.created_at}>{adminTime(row.created_at,locale)}</time></p></li>)}</ul>:<p>{t.empty}</p>;
}
export function AdminUserList({rows,locale}:{rows:AdminUser[];locale:Locale}){
 const t=controlCopy(locale);return rows.length?<div className="admin-table-wrap"><table className="admin-table admin-table-mobile"><thead><tr>{[t.users,t.classes,t.role,t.created,t.lastActivity,t.devices].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><Link prefetch={false} href={"/admin/users/"+row.id} className="text-link">{row.display_name||t.unnamed}</Link></td><td data-label={t.classes}>{row.class_name||t.noClass}</td><td data-label={t.role}>{t[row.role]}</td><td data-label={t.created}>{adminTime(row.created_at,locale)}</td><td data-label={t.lastActivity}>{adminTime(row.last_activity,locale)}</td><td>{row.device} · {row.browser}</td></tr>)}</tbody></table></div>:<p>{t.empty}</p>;
}
export function AdminPagination({href,params,page,total}:{href:string;params:Record<string,string|undefined>;page:number;total:number}){
 const link=(n:number)=>{const p=new URLSearchParams();for(const[k,v]of Object.entries(params))if(v&&k!=="page")p.set(k,v);p.set("page",String(n));return href+"?"+p;};
 return <AdminPaginationLinks previous={page>0?link(page-1):null} next={(page+1)*25<total&&page<400?link(page+1):null} page={page}/>;
}
