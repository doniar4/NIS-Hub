"use client";
import Link from "next/link";
import {useI18n} from "./locale-provider";
import {controlCopy} from "@/lib/admin-control";
export function AdminPaginationLinks({previous,next,page}:{previous:string|null;next:string|null;page:number}){const {locale}=useI18n(),t=controlCopy(locale);return <div className="admin-pagination">{previous&&<Link href={previous} className="text-link">{t.previous}</Link>}<span>{t.page} {page+1}</span>{next&&<Link href={next} className="text-link">{t.next}</Link>}</div>;}
