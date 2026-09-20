"use server";
import { actionContext } from "@/lib/auth";
import { smsConfig } from "@/lib/sms/config";
import { SmsHttp } from "@/lib/sms/http";
import { loginSms, validCredentials } from "@/lib/sms/login";
import { fetchDiary } from "@/lib/sms/grades";
import { clearSmsSession, readSmsSession, saveSmsSession, hasSmsSession } from "@/lib/sms/session";
import { safeSmsError } from "@/lib/sms/errors";
import type { SmsResult } from "@/lib/sms/types";
// Concurrency and a minimum interval per warm process; no retries or polling.
// This map contains NIS user IDs + expiry only, never credentials or SMS responses.
const active = new Map<string,number>();
async function operation(connect: boolean, form?: FormData): Promise<SmsResult> {
  let context: Awaited<ReturnType<typeof actionContext>>;
  try { context=await actionContext(); } catch { return {connected:false,error:"session_expired"}; }
  const {supabase,user}=context;
  const now=Date.now();
  for(const [id,until] of active) if(until<now) active.delete(id);
  if(active.has(user.id) || active.size>=1000) return {connected:await hasSmsSession(),error:"busy"};
  active.set(user.id,now+120000);
  let connected=false;
  try {
    const config=smsConfig();
    if(connect) {
      const iin=form?.get("iin"), password=form?.get("password");
      if(!validCredentials(iin,password)) return {connected:false,error:"invalid_input"};
      await clearSmsSession(supabase);
      const http=new SmsHttp(config);
      const page=await loginSms(http,iin,password as string);
      await saveSmsSession(supabase,user.id,http.cookies);
      connected=true;
      const snapshot=await fetchDiary(http,page);
      // Preserve rotated cookies but never extend the original hard deadline.
      const session=await readSmsSession(supabase,user.id);
      await saveSmsSession(supabase,user.id,http.cookies,session.expires);
      return {connected:true,snapshot};
    }
    const session=await readSmsSession(supabase,user.id);
    connected=true;
    const http=new SmsHttp(config,session.cookies);
    const snapshot=await fetchDiary(http);
    await saveSmsSession(supabase,user.id,http.cookies,session.expires);
    return {connected:true,snapshot};
  } catch(error) {
    const code=safeSmsError(error);
    if(code==="session_expired") {
      try { await clearSmsSession(supabase); } catch { /* Cookie cleared even when encrypted TTL cleanup is unavailable. */ }
      connected=false;
    }
    return {connected,error:code};
  } finally {
    form?.delete("iin");form?.delete("password");
    active.set(user.id,Date.now()+2000);
  }
}
export async function connectSms(form: FormData): Promise<SmsResult> { return operation(true,form); }
export async function refreshSms(): Promise<SmsResult> { return operation(false); }
export async function disconnectSms(): Promise<SmsResult> {
  try { const {supabase}=await actionContext();await clearSmsSession(supabase);return {connected:false}; }
  catch { return {connected:false,error:"sms_unavailable"}; }
}
