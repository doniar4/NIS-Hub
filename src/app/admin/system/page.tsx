import {Suspense} from "react";
import {requireAdmin} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {controlCopy} from "@/lib/admin-control";
import {PageIntro} from "@/components/ui";
import {AdminSkeleton} from "@/components/admin-loading";
import {AdminSystemConfiguration,AdminDatabaseHealth} from "@/components/admin-system";
export default async function SystemPage(){await requireAdmin();const {locale}=await getI18n();return <><PageIntro title={controlCopy(locale).system}/><div className="admin-grid admin-system"><AdminSystemConfiguration locale={locale}/><Suspense fallback={<AdminSkeleton locale={locale}/>}><AdminDatabaseHealth locale={locale}/></Suspense></div></>;}
