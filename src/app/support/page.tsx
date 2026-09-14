import {requireViewer} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {v05Copy} from "@/lib/v05-copy";
import {SiteShell} from "@/components/site-shell";
import {PageIntro} from "@/components/ui";
import {ActionForm} from "@/components/action-form";
import {TicketFields} from "@/components/ticket-fields";
import {TicketList} from "@/components/ticket-list";
import {createTicket} from "@/app/actions/support";
export default async function SupportPage({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}){
 await requireViewer("/support");const {locale}=await getI18n(),t=v05Copy(locale),params=await searchParams;
 return <SiteShell><PageIntro title={t.support}/><div className="mt-8 grid gap-8 lg:grid-cols-2"><section><h2 className="section-title">{t.support}</h2><TicketList status={params.status} page={Number(params.page??0)}/></section><section className="surface-card"><h2 className="section-title mb-5">{t.newTicket}</h2><ActionForm action={createTicket} label={t.send}><TicketFields locale={locale}/></ActionForm></section></div></SiteShell>;
}
