import {z} from "zod";
export const ticketCategories=["platform","schedule","library","account","data","other"] as const;
export const ticketStatuses=["open","in_progress","resolved","closed"] as const;
export const ticketSchema=z.object({category:z.enum(ticketCategories),title:z.string().trim().min(1).max(120),description:z.string().trim().min(1).max(5000)});
export const replySchema=z.string().trim().min(1).max(5000);
/** The persistence operation finishes first. A notifier never controls its commit. */
export async function persistTicketThenNotify<T>(persist:()=>Promise<T>,notify:(ticket:T)=>Promise<unknown>):Promise<T>{
 const ticket=await persist();
 try {await notify(ticket);} catch {/* Notification transport failure cannot discard a saved ticket. */}
 return ticket;
}
