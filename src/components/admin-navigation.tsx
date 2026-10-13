"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n } from "./locale-provider";
import { adminHref, adminSections, controlCopy } from "@/lib/admin-control";

function Pending() { const {pending} = useLinkStatus(); return <span aria-hidden className={"admin-link-pending" + (pending ? " is-pending" : "")}/>; }
function NavigationLink({href, label, current}: {href:string;label:string;current:boolean}) {
  const [intent, setIntent] = useState(false);
  return <Link href={href} prefetch={intent ? null : false} onMouseEnter={() => setIntent(true)} onFocus={() => setIntent(true)} aria-current={current ? "page" : undefined} className="admin-nav-link"><span>{label}</span><Pending/></Link>;
}
export function AdminNavigation({kind="main"}:{kind?:"main"|"schedule"|"content"}) {
  const path=usePathname(), {locale}=useI18n(), t=controlCopy(locale);
  const links=kind==="main" ? adminSections.map(key=>({href:adminHref(key),label:t[key]})) : kind==="schedule" ? [
    ["/admin/schedule",t.current],["/admin/schedule/import",t.imports],["/admin/schedule/versions",t.versions],["/admin/schedule/calendar",t.calendar],["/admin/schedule/classes",t.classes],
  ].map(([href,label])=>({href,label})) : [["/admin/content",t.books],["/admin/content/subjects",t.subjects]].map(([href,label])=>({href,label}));
  return <nav className={"admin-nav "+(kind==="main"?"admin-nav-main":"admin-nav-secondary")} aria-label={kind==="main"?t.control:t[kind]}>{links.map(({href,label})=><NavigationLink key={href} href={href} label={label} current={kind==="main" ? href==="/admin"?path===href:path===href||path.startsWith(href+"/")||href==="/admin/tickets"&&path==="/admin/community" : path===href}/>)}</nav>;
}
