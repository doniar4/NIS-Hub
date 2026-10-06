import {Suspense} from "react";
import {requireAdmin} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {controlCopy} from "@/lib/admin-control";
import {uuid} from "@/lib/validation";
import {ActivityFilter,ActivityStats,ActivityFeed,OnlineUsers,ActivityClasses} from "@/components/admin-activity";
import {AdminSkeleton} from "@/components/admin-loading";
import {AdminRefresh} from "@/components/admin-refresh";
import {PageIntro} from "@/components/ui";
export default async function ActivityPage({searchParams}:{searchParams:Promise<{class?:string;page?:string;classesPage?:string}>}){
 await requireAdmin();const [{locale},params]=await Promise.all([getI18n(),searchParams]),classId=uuid.safeParse(params.class).success?params.class:undefined;
 return <><PageIntro title={controlCopy(locale).activity}/><AdminRefresh/><Suspense fallback={<AdminSkeleton locale={locale} compact/>}><ActivityFilter locale={locale} classId={classId}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale}/>}><ActivityStats locale={locale} classId={classId}/></Suspense><div className="space-y-5"><Suspense fallback={<AdminSkeleton locale={locale}/>}><OnlineUsers locale={locale} classId={classId}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale}/>}><ActivityFeed locale={locale} classId={classId} page={params.page}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale}/>}><ActivityClasses locale={locale} page={params.classesPage}/></Suspense></div></>;
}
