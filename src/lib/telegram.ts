import "server-only";
import {sendTicketNotice,type TicketNotice} from "./telegram-transport";
export async function notifyNewTicket(ticket:TicketNotice){
 const token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.TELEGRAM_ADMIN_CHAT_ID,origin=process.env.APP_BASE_URL;
 const outcome=await sendTicketNotice(ticket,token&&chatId&&origin?{token,chatId,origin}:null);
 if(outcome!=="sent")console.warn("[support-notification]",outcome);
 // Never log fetch errors/response bodies: Telegram puts the bot token in its URL.
 return outcome;
}
