export type TicketNotice={id:string;category:string;createdAt:string};
export type TelegramConfig={token:string;chatId:string;origin:string};
export type NoticeOutcome="sent"|"disabled"|"failed";
export async function sendTicketNotice(ticket:TicketNotice,config:TelegramConfig|null,request:typeof fetch=fetch):Promise<NoticeOutcome>{
 if(!config)return "disabled";
 try{
  const origin=new URL(config.origin);
  if(origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash||
    (origin.protocol!=="https:" && !(origin.protocol==="http:" && ["localhost","127.0.0.1"].includes(origin.hostname))))return "failed";
  // Only reference, category and time. No title, body, name, email, tokens or signed URLs.
  const text=["NIS Hub · new support ticket",ticket.id,ticket.category,ticket.createdAt,origin.origin+"/support/"+ticket.id].join("\n");
  const response=await request("https://api.telegram.org/bot"+config.token+"/sendMessage",{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:config.chatId,text,link_preview_options:{is_disabled:true}}),
   signal:AbortSignal.timeout(5000),cache:"no-store",redirect:"error"
  });
  if(!response.ok)return "failed";
  const body:unknown=await response.json();
  return typeof body==="object"&&body!==null&&"ok" in body&&body.ok===true?"sent":"failed";
 }catch{return "failed";}
}
