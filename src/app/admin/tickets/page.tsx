import Link from "next/link";
import {Suspense} from "react";
import {AdminTicketStats} from "@/components/admin-ticket-stats";
import {AdminSkeleton} from "@/components/admin-loading";
import {requireAdmin} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {v05Copy} from "@/lib/v05-copy";
import {PageIntro} from "@/components/ui";
import {TicketList} from "@/components/ticket-list";
export default async function TicketsPage({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}){
 await requireAdmin();const {locale}=await getI18n(),t=v05Copy(locale),params=await searchParams;
 return <><Link className="text-link" href="/admin/community">{locale==="ru"?"Модерация сообщества":locale==="kk"?"Қауымдастық модерациясы":"Community moderation"}</Link><PageIntro title={t.support}/><Suspense fallback={<AdminSkeleton locale={locale}/>}><AdminTicketStats locale={locale}/></Suspense><Suspense fallback={<AdminSkeleton locale={locale}/>}><TicketList admin status={params.status} page={Number(params.page??0)}/></Suspense></>;
}
