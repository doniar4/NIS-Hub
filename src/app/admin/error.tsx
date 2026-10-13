"use client";
import {useI18n} from "@/components/locale-provider";
import {controlCopy} from "@/lib/admin-control";
export default function AdminError({reset}:{reset:()=>void}){const {locale}=useI18n(),t=controlCopy(locale);return <section className="surface-card"><p role="alert">{t.unavailable}</p><button type="button" className="button button-secondary mt-4" onClick={reset}>{t.refresh}</button></section>;}
