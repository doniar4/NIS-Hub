"use client";
import {useRouter} from "next/navigation";
import {useTransition} from "react";
import {useI18n} from "./locale-provider";
import {controlCopy} from "@/lib/admin-control";
export function AdminRefresh(){const router=useRouter(),[pending,start]=useTransition(),{locale}=useI18n(),t=controlCopy(locale);return <button type="button" className="button button-secondary" disabled={pending} onClick={()=>start(()=>router.refresh())}>{pending?t.loading:t.refresh}</button>;}
