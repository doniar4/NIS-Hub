import {Suspense} from "react";
import {redirect} from "next/navigation";
import {requireAdmin} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {controlCopy} from "@/lib/admin-control";
import {AdminWeeklySchedule,AdminEduPage} from "@/components/admin-schedule-tools";
import {AdminSkeleton} from "@/components/admin-loading";
import {PageIntro} from "@/components/ui";
export default async function SchedulePage({searchParams}:{searchParams:Promise<{id?:string;tab?:string}>}){
 await requireAdmin();const params=await searchParams;if(["import","versions","calendar","classes"].includes(params.tab??""))redirect("/admin/schedule/"+params.tab);
 const {locale}=await getI18n(),t=controlCopy(locale);
 return <><PageIntro title={t.schedule}/><Suspense fallback={<AdminSkeleton locale={locale}/>}><AdminWeeklySchedule id={params.id}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale}/>}><AdminEduPage/></Suspense></>;
}
