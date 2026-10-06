import {AdminSkeleton} from "@/components/admin-loading";
import {getI18n} from "@/lib/i18n-server";
export default async function Loading(){const {locale}=await getI18n();return <AdminSkeleton locale={locale}/>;}
