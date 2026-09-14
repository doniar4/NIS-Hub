import Link from "next/link";
import {requireAdmin} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {v05Copy} from "@/lib/v05-copy";
import {SiteShell} from "@/components/site-shell";
import {PageIntro} from "@/components/ui";
import {TicketList} from "@/components/ticket-list";
export default async function TicketsPage({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}){
 await requireAdmin();const {locale}=await getI18n(),t=v05Copy(locale),params=await searchParams;
 return <SiteShell><Link className="text-link" href="/admin">{t.dashboard}</Link><PageIntro title={t.support}/><TicketList admin status={params.status} page={Number(params.page??0)}/></SiteShell>;
}
