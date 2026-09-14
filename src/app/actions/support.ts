"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {actionContext} from "@/lib/auth";
import {uuid} from "@/lib/validation";
import {ticketSchema,replySchema,ticketStatuses,persistTicketThenNotify} from "@/lib/support";
import {getI18n} from "@/lib/i18n-server";
import {v05Copy} from "@/lib/v05-copy";
import {notifyNewTicket} from "@/lib/telegram";
import {createTicketNotice} from "@/lib/telegram-message";
import type {ActionState} from "@/lib/action-state";
export async function createTicket(_:ActionState,form:FormData):Promise<ActionState>{
 const {locale}=await getI18n(),t=v05Copy(locale);let id:string;
 try{
  const {supabase,user}=await actionContext(),parsed=ticketSchema.safeParse(Object.fromEntries(form));
  if(!parsed.success)return {error:t.error};
  id=await persistTicketThenNotify(async()=>{
   const {data,error}=await supabase.rpc("create_support_ticket",{p_category:parsed.data.category,p_title:parsed.data.title,p_description:parsed.data.description});
   if(error)throw new Error("Ticket save failed");return data;
  },async ticketId=>{
   // Optional identity enrichment happens only after the ticket commits. Never use form names/email.
   let displayName:string|null=null;
   try {
    const {data,error}=await supabase.from("profiles").select("display_name").eq("id",user.id)
     .abortSignal(AbortSignal.timeout(1500)).maybeSingle();
    if(!error)displayName=data?.display_name??null;
   }catch{/* Missing/unavailable profile must not prevent the notification or saved-ticket redirect. */}
   return notifyNewTicket(createTicketNotice({id:ticketId,...parsed.data,displayName,createdAt:new Date().toISOString()}));
  });
 }catch{return {error:t.error};}
 revalidatePath("/support");revalidatePath("/admin");redirect("/support/"+id);
}
export async function replyTicket(_:ActionState,form:FormData):Promise<ActionState>{
 const {locale}=await getI18n(),t=v05Copy(locale);
 try{
  const {supabase}=await actionContext(),id=uuid.safeParse(form.get("id")),body=replySchema.safeParse(form.get("body"));
  if(!id.success||!body.success)return {error:t.error};
  const {error}=await supabase.rpc("reply_support_ticket",{p_ticket:id.data,p_body:body.data});if(error)return {error:t.error};
 }catch{return {error:t.error};}
 revalidatePath("/","layout");return {success:t.saved};
}
export async function changeTicketStatus(_:ActionState,form:FormData):Promise<ActionState>{
 const {locale}=await getI18n(),t=v05Copy(locale);
 try{
  const {supabase}=await actionContext(true),id=uuid.safeParse(form.get("id")),status=z.enum(ticketStatuses).safeParse(form.get("status"));
  if(!id.success||!status.success)return {error:t.error};
  const {error}=await supabase.rpc("set_support_status",{p_ticket:id.data,p_status:status.data});if(error)return {error:t.error};
 }catch{return {error:t.error};}
 revalidatePath("/","layout");return {success:t.saved};
}
