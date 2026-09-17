import {notFound} from "next/navigation";
import {requireViewer} from "@/lib/auth";
import {database} from "@/lib/queries";
import {uuid} from "@/lib/validation";
import {getI18n} from "@/lib/i18n-server";
import {SiteShell} from "@/components/site-shell";
import {TicketConversation} from "@/components/ticket-conversation";
import {replyTicket,changeTicketStatus} from "@/app/actions/support";
export default async function TicketPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}){
 const {id}=await params;if(!uuid.safeParse(id).success)notFound();
 const {profile}=await requireViewer("/support/"+id),{locale}=await getI18n(),db=await database();
 const page=Number((await searchParams).page??0);if(!Number.isInteger(page)||page<0||page>10000)notFound();
 const {data:ticket,error}=await db.from("support_tickets").select("*").eq("id",id).maybeSingle();
 if(error)throw new Error("Ticket unavailable");if(!ticket)notFound();
 const [messages,events]=await Promise.all([db.from("support_messages").select("*").eq("ticket_id",id).order("created_at",{ascending:false}).order("id").range(page*100,page*100+99),
 db.from("support_status_events").select("*").eq("ticket_id",id).order("created_at",{ascending:false}).order("id").range(page*100,page*100+99)]);
 if(messages.error||events.error)throw new Error("Conversation unavailable");
 return <SiteShell><TicketConversation ticket={ticket} messages={messages.data} events={events.data} locale={locale} admin={profile.role==="admin"} page={page} replyAction={replyTicket} statusAction={changeTicketStatus}/></SiteShell>;
}
