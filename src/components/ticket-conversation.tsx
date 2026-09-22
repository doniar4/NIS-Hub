import Link from "next/link";
import type {Locale} from "@/lib/i18n";
import type {SupportTicket,SupportMessage,SupportStatusEvent} from "@/lib/database.types";
import type {FormAction} from "@/lib/action-state";
import {v05Copy} from "@/lib/v05-copy";
import {PageIntro} from "./ui";
import {ActionForm} from "./action-form";
export function TicketConversation({ticket,messages,events,locale,admin,page=0,replyAction,statusAction}:{
 ticket:SupportTicket;messages:SupportMessage[];events:SupportStatusEvent[];locale:Locale;admin:boolean;page?:number;replyAction:FormAction;statusAction:FormAction;
}){
 const t=v05Copy(locale),id=ticket.id;
 return <><Link className="text-link" href={admin?"/admin/tickets":"/support"}>{t.support}</Link><PageIntro title={ticket.title}>{t.categories[ticket.category]} · {t.statuses[ticket.status]}</PageIntro>
 <div className="ticket-conversation my-8 grid gap-6"><section className="min-w-0">
 <article className="surface-card"><p className="text-sm">{ticket.created_at.slice(0,19).replace("T"," ")} UTC</p><p className="whitespace-pre-wrap break-words mt-3">{ticket.description}</p></article>
 <p className="my-4 text-sm">{t.scope}</p><ol className="space-y-4">{[...messages].reverse().map(message=><li key={message.id} className="surface-card"><h2 className="font-semibold">{message.author_role==="admin"?t.adminReply:t.studentReply}</h2><time className="text-sm">{message.created_at.slice(0,19).replace("T"," ")} UTC</time><p className="whitespace-pre-wrap break-words mt-3">{message.body}</p></li>)}</ol>
 <nav className="my-4 flex gap-4" aria-label={t.message}>{page>0&&<Link className="text-link" href={"/support/"+id}>{t.newer}</Link>}{(messages.length===100||events.length===100)&&<Link className="text-link" href={"/support/"+id+"?page="+(page+1)}>{t.older}</Link>}</nav>
 {admin||["open","in_progress"].includes(ticket.status)?<ActionForm action={replyAction} label={t.reply}><input type="hidden" name="id" value={id}/><label className="block"><span className="field-label">{t.message}</span><textarea name="body" className="field" rows={5} maxLength={5000} required/></label></ActionForm>:<p>{t.closedHint}</p>}
 </section><aside className="surface-card self-start">
 {admin&&<ActionForm action={statusAction} label={t.status}><input type="hidden" name="id" value={id}/><label><span className="field-label">{t.status}</span><select className="field" name="status" defaultValue={ticket.status}>{Object.entries(t.statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></ActionForm>}
 <h2 className="section-title mt-6">{t.status}</h2><ul>{events.map(event=><li className="py-3" key={event.id}>{t.statuses[event.previous_status]} → {t.statuses[event.status]}<time className="block text-sm">{event.created_at.slice(0,19).replace("T"," ")} UTC</time></li>)}</ul>
 </aside></div></>;
}
