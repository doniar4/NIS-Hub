import Link from "next/link";
import {notFound} from "next/navigation";
import {database} from "@/lib/queries";
import {getI18n} from "@/lib/i18n-server";
import {v05Copy} from "@/lib/v05-copy";
import {ticketStatuses} from "@/lib/support";
export async function TicketList({admin=false,status,page=0}:{admin?:boolean;status?:string;page?:number}){
 const {locale}=await getI18n(),t=v05Copy(locale),db=await database(),path=admin?"/admin/tickets":"/support";
 if(!Number.isInteger(page)||page<0||page>10000|| (status&&!ticketStatuses.includes(status as typeof ticketStatuses[number])))notFound();
 let query=db.from("support_tickets").select("id,title,category,status,created_at,needs_admin_reply").order("created_at",{ascending:false}).order("id").range(page*100,page*100+99);
 if(status)query=query.eq("status",status as typeof ticketStatuses[number]);
 const {data,error}=await query;if(error)throw new Error("Tickets unavailable");
 return <><nav className="my-6 flex flex-wrap gap-3" aria-label={t.status}>{[["",t.all],...Object.entries(t.statuses)].map(([key,label])=><Link key={key} className="text-link" aria-current={(status??"")===key?"page":undefined} href={path+(key?"?status="+key:"")}>{label}</Link>)}</nav>
 <p className="text-sm">{t.scope}</p><ul className="mt-4 divide-y divide-[var(--line)]">{data.map(row=><li className="py-5" key={row.id}>
 <Link className="text-link font-semibold break-words" href={"/support/"+row.id}>{row.title}</Link><p>{t.categories[row.category]} · {t.statuses[row.status]} · {row.created_at.slice(0,10)}</p>
 {admin&&row.needs_admin_reply&&["open","in_progress"].includes(row.status)&&<p className="text-sm">{t.unread}</p>}
 </li>)}</ul>{!data.length&&<p>{t.empty}</p>}<nav className="my-6 flex gap-4" aria-label={t.support}>
 {page>0&&<Link className="text-link" href={path}>{t.newer}</Link>}{data.length===100&&<Link className="text-link" href={path+"?page="+(page+1)+(status?"&status="+status:"")}>{t.older}</Link>}</nav></>;
}
