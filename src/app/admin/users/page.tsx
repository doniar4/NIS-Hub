import {Suspense} from "react";
import {requireAdmin} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {controlCopy} from "@/lib/admin-control";
import {AdminUsersFilters,AdminUsersResults,type UserParams} from "@/components/admin-users";
import {AdminSkeleton} from "@/components/admin-loading";
import {PageIntro} from "@/components/ui";
export default async function UsersPage({searchParams}:{searchParams:Promise<UserParams>}){
 await requireAdmin();const [{locale},params]=await Promise.all([getI18n(),searchParams]);
 return <><PageIntro title={controlCopy(locale).users}/><Suspense fallback={<AdminSkeleton locale={locale} compact/>}><AdminUsersFilters params={params} locale={locale}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale}/>}><AdminUsersResults params={params} locale={locale}/></Suspense></>;
}
