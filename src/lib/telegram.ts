import "server-only";
import {sendTicketNotice,type TicketNotice} from "./telegram-transport";
import {getSiteOrigin} from "./site-url";
export async function notifyNewTicket(ticket:TicketNotice){
 const token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.TELEGRAM_ADMIN_CHAT_ID;
 let origin:string|null=null;
 try{origin=getSiteOrigin();}catch{/* Invalid site configuration must never roll back a saved ticket. */}
 const outcome=await sendTicketNotice(ticket,token&&chatId&&origin?{token,chatId,origin}:null);
 if(outcome!=="sent")console.warn("[support-notification]",outcome);
 // Never log fetch errors/response bodies: Telegram puts the bot token in its URL.
 return outcome;
}
