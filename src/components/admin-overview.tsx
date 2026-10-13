import {Suspense} from "react";
import {requireAdmin} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {controlCopy} from "@/lib/admin-control";
import {PageIntro} from "./ui";
import {AdminSkeleton} from "./admin-loading";
import {OverviewStats,OverviewChart,OverviewClasses,OverviewRegistrations,OverviewFeed,OverviewHealth} from "./admin-overview-widgets";
export async function AdminOverview(){
 await requireAdmin();const {locale}=await getI18n(),t=controlCopy(locale);
 return <><PageIntro title={t.overview}/><Suspense fallback={<AdminSkeleton locale={locale}/>}><OverviewStats locale={locale}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale}/>}><OverviewChart locale={locale}/></Suspense><div className="admin-grid"><Suspense fallback={<AdminSkeleton locale={locale}/>}><OverviewClasses locale={locale}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale}/>}><OverviewRegistrations locale={locale}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale}/>}><OverviewFeed locale={locale}/></Suspense><OverviewHealth locale={locale}/></div></>;
}
