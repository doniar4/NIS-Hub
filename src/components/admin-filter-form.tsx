"use client";
import {useRouter} from "next/navigation";
import {useTransition,type ReactNode} from "react";
import Link from "next/link";
import {useI18n} from "./locale-provider";
import {controlCopy} from "@/lib/admin-control";
export function AdminFilterForm({href,children}:{href:string;children:ReactNode}){
 const router=useRouter(),[pending,start]=useTransition(),{locale}=useI18n(),t=controlCopy(locale);
 return <form className="admin-filters" aria-busy={pending} onSubmit={e=>{e.preventDefault();const params=new URLSearchParams();for(const [key,value] of new FormData(e.currentTarget))if(typeof value==="string"&&value.trim())params.set(key,value.trim());start(()=>router.push(href+(params.size?"?"+params:"")));}}>{children}<button className="button" disabled={pending}>{pending?t.loading:t.apply}</button><Link href={href} className="text-link">{t.reset}</Link></form>;
}
