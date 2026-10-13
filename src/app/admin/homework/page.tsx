import {Suspense} from "react";
import {requireAdmin} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {controlCopy} from "@/lib/admin-control";
import {HomeworkStats,HomeworkFilters,HomeworkResults,type HomeworkParams} from "@/components/admin-homework";
import {AdminSkeleton} from "@/components/admin-loading";
import {PageIntro} from "@/components/ui";
export default async function HomeworkPage({searchParams}:{searchParams:Promise<HomeworkParams>}){await requireAdmin();const [{locale},params]=await Promise.all([getI18n(),searchParams]);return <><PageIntro title={controlCopy(locale).homework}/><Suspense fallback={<AdminSkeleton locale={locale}/>}><HomeworkStats locale={locale}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale} compact/>}><HomeworkFilters locale={locale} params={params}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale}/>}><HomeworkResults locale={locale} params={params}/></Suspense></>;}
