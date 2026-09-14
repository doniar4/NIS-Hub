import Link from "next/link";
import {notFound} from "next/navigation";
import {requireViewer} from "@/lib/auth";
import {database} from "@/lib/queries";
import {uuid} from "@/lib/validation";
import {getI18n} from "@/lib/i18n-server";
import {v05Copy} from "@/lib/v05-copy";
import {SiteShell} from "@/components/site-shell";
import {PageIntro} from "@/components/ui";
import {ActionForm} from "@/components/action-form";
import {replyTicket,changeTicketStatus} from "@/app/actions/support";
export default async function TicketPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}){
 const {id}=await params;if(!uuid.safeParse(id).success)notFound();
 const {profile}=await requireViewer("/support/"+id),admin=profile.role==="admin",{locale}=await getI18n(),t=v05Copy(locale),db=await database();
 const page=Number((await searchParams).page??0);if(!Number.isInteger(page)||page<0||page>10000)notFound();
 const {data:ticket,error}=await db.from("support_tickets").select("*").eq("id",id).maybeSingle();
 if(error)throw new Error("Ticket unavailable");if(!ticket)notFound();
 const [messages,events]=await Promise.all([db.from("support_messages").select("*").eq("ticket_id",id).order("created_at",{ascending:false}).order("id").range(page*100,page*100+99),
 db.from("support_status_events").select("*").eq("ticket_id",id).order("created_at",{ascending:false}).order("id").range(page*100,page*100+99)]);
 if(messages.error||events.error)throw new Error("Conversation unavailable");
 return <SiteShell><Link className="text-link" href={admin?"/admin/tickets":"/support"}>{t.support}</Link><PageIntro title={ticket.title}>{t.categories[ticket.category]} · {t.statuses[ticket.status]}</PageIntro>
 <div className="my-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]"><section className="min-w-0">
 <article className="surface-card"><p className="text-sm">{ticket.created_at.slice(0,19).replace("T"," ")}</p><p className="whitespace-pre-wrap break-words mt-3">{ticket.description}</p></article>
 <p className="my-4 text-sm">{t.scope}</p><ol className="space-y-4">{[...messages.data].reverse().map(message=><li key={message.id} className="surface-card"><h2 className="font-semibold">{message.author_role==="admin"?t.adminReply:t.studentReply}</h2><time className="text-sm">{message.created_at.slice(0,19).replace("T"," ")}</time><p className="whitespace-pre-wrap break-words mt-3">{message.body}</p></li>)}</ol>
 <nav className="my-4 flex gap-4" aria-label={t.message}>{page>0&&<Link className="text-link" href={"/support/"+id}>{t.newer}</Link>}{(messages.data.length===100||events.data.length===100)&&<Link className="text-link" href={"/support/"+id+"?page="+(page+1)}>{t.older}</Link>}</nav>
 {admin||["open","in_progress"].includes(ticket.status)?<ActionForm action={replyTicket} label={t.reply}><input type="hidden" name="id" value={id}/><label className="block"><span className="field-label">{t.message}</span><textarea name="body" className="field" rows={5} maxLength={5000} required/></label></ActionForm>:<p>{t.closedHint}</p>}
 </section><aside className="surface-card self-start">
 {admin&&<ActionForm action={changeTicketStatus} label={t.saved}><input type="hidden" name="id" value={id}/><label><span className="field-label">{t.status}</span><select className="field" name="status" defaultValue={ticket.status}>{Object.entries(t.statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></ActionForm>}
 <h2 className="section-title mt-6">{t.status}</h2><ul>{events.data.map(event=><li className="py-3" key={event.id}>{t.statuses[event.previous_status]} → {t.statuses[event.status]}<time className="block text-sm">{event.created_at.slice(0,19).replace("T"," ")}</time></li>)}</ul>
 </aside></div></SiteShell>;
}
