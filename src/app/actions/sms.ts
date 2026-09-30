"use server";
import { actionContext } from "@/lib/auth";
import { smsConfig } from "@/lib/sms/config";
import { SmsHttp } from "@/lib/sms/http";
import { createHmac } from "node:crypto";
import { beginSmsLogin, submitSmsLogin, sendSmsCode, refreshSmsCaptcha, validCredentials, type SmsLoginAnswers, type SmsLoginStep } from "@/lib/sms/login";
import { clearPendingSmsLogin, readPendingSmsLogin, savePendingSmsLogin, type PendingSmsLogin } from "@/lib/sms/pending";
import { fetchDiary, fetchDiarySubject, fetchRecentWorks } from "@/lib/sms/grades";
import { clearSmsSession, readSmsSession, saveSmsSession, hasSmsSession } from "@/lib/sms/session";
import { safeSmsError, SmsError } from "@/lib/sms/errors";
import type { SmsAssessment, SmsDiarySelection, SmsErrorCode, SmsResult, SmsSubjectDetailResult } from "@/lib/sms/types";
// Concurrency and a minimum interval per warm process; no retries or polling.
// This map contains NIS user IDs + expiry only, never credentials or SMS responses.
const active = new Map<string,number>();
const loginFields = ["iin","password","captchaInput","twoFactorAuthCode","application2FACode"] as const;
function cleanLoginForm(form?: FormData) { for (const field of loginFields) form?.delete(field); }
function readAnswers(form: FormData): SmsLoginAnswers {
  const answers: SmsLoginAnswers = {};
  for (const field of ["captchaInput","twoFactorAuthCode","application2FACode"] as const) {
    const value = form.get(field) ?? "";
    if (typeof value !== "string" || value.length > 128 || /[\x00-\x1f\x7f]/.test(value)) throw new SmsError("invalid_input");
    answers[field] = value.trim();
  }
  return answers;
}
function iinDigest(iin: string, userId: string, secret: Buffer) {
  return createHmac("sha256",secret).update("nis-sms-login:" + userId + ":" + iin).digest("hex");
}
async function finishLogin(context: Awaited<ReturnType<typeof actionContext>>, http: SmsHttp, step: SmsLoginStep, iin: string, prior?: PendingSmsLogin): Promise<SmsResult> {
  const {supabase,user} = context;
  if (step.challenge) {
    if (prior?.challenge.captcha && (step.challenge.twoFactor || step.challenge.application2FA)) {
      const captcha=await refreshSmsCaptcha(http);
      step.challenge={...step.challenge,captcha:true,image:captcha.image};
    }
    const {captcha,twoFactor,application2FA,image} = step.challenge;
    const state: PendingSmsLogin = {
      version:1, expires:prior?.expires ?? Date.now()+5*60*1000, cookies:http.cookies, fields:step.fields,
      challenge:{captcha,twoFactor,application2FA}, attempts:prior?.attempts ?? 0,
      iinHash:iinDigest(iin,user.id,http.config.secret), ...(prior?.codeSentAt ? {codeSentAt:prior.codeSentAt} : {}),
    };
    if (state.attempts >= 5) throw new SmsError("session_expired");
    await savePendingSmsLogin(supabase,user.id,state);
    return {connected:false,challenge:{...state.challenge,...(image?{image}:{}),expiresAt:state.expires,...(state.codeSentAt?{resendAt:state.codeSentAt+60000}:{})}};
  }
  await clearPendingSmsLogin(supabase,user.id);
  await saveSmsSession(supabase,user.id,http.cookies);
  const session = await readSmsSession(supabase,user.id);
  try {
    const snapshot = await fetchDiary(http,step.page);
    await saveSmsSession(supabase,user.id,http.cookies,session.expires);
    return {connected:true,snapshot};
  } catch (error) {
    const code = safeSmsError(error);
    if (code === "session_expired") { await clearSmsSession(supabase); return {connected:false,error:code}; }
    return {connected:true,error:code};
  }
}
async function operation(connect: boolean, form?: FormData, selection:SmsDiarySelection={}): Promise<SmsResult> {
  let context: Awaited<ReturnType<typeof actionContext>>;
  try { context=await actionContext(); } catch { cleanLoginForm(form); return {connected:false,error:"session_expired"}; }
  const {supabase,user}=context;
  const now=Date.now();
  for(const [id,until] of active) if(until<now) active.delete(id);
  if(active.has(user.id) || active.size>=1000) { cleanLoginForm(form); return {connected:await hasSmsSession(),error:"busy"}; }
  active.set(user.id,now+120000);
  let connected=false;
  try {
    const config=smsConfig();
    if(connect) {
      const iin=form?.get("iin"), password=form?.get("password");
      if(!validCredentials(iin,password)) return {connected:false,error:"invalid_input"};
      await clearPendingSmsLogin(supabase,user.id);
      await clearSmsSession(supabase);
      const http=new SmsHttp(config);
      return await finishLogin(context,http,await beginSmsLogin(http,iin,password as string),iin);
    }
    const session=await readSmsSession(supabase,user.id);
    connected=true;
    const http=new SmsHttp(config,session.cookies);
    const snapshot=await fetchDiary(http,undefined,selection);
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
    cleanLoginForm(form);
    active.set(user.id,Date.now()+2000);
  }
}
export async function connectSms(form: FormData): Promise<SmsResult> { return operation(true,form); }
async function continueLogin(form: FormData, sendCode: boolean): Promise<SmsResult> {
  let context: Awaited<ReturnType<typeof actionContext>>;
  try { context=await actionContext(); } catch { cleanLoginForm(form); return {connected:false,error:"session_expired"}; }
  const {supabase,user}=context, now=Date.now();
  for (const [id,until] of active) if (until<now) active.delete(id);
  if (active.has(user.id) || active.size>=1000) { cleanLoginForm(form); return {connected:false,error:"busy"}; }
  active.set(user.id,now+120000);
  let state: PendingSmsLogin | undefined;
  let http: SmsHttp | undefined;
  try {
    const config=smsConfig();
    state=await readPendingSmsLogin(supabase,user.id);
    const iin=form.get("iin"), password=form.get("password");
    if (!validCredentials(iin,password)) throw new SmsError("invalid_input");
    if (iinDigest(iin,user.id,config.secret)!==state.iinHash) throw new SmsError("session_expired");
    if (state.attempts>=5) throw new SmsError("session_expired");
    const answers=readAnswers(form);
    http=new SmsHttp(config,state.cookies);
    if (sendCode) {
      if (!state.challenge.twoFactor) throw new SmsError("invalid_input");
      if (state.codeSentAt && now < state.codeSentAt+60000) throw new SmsError("busy");
      // Persist before sending: a timeout must not allow a rapid duplicate SMS.
      state.codeSentAt=now;
      await savePendingSmsLogin(supabase,user.id,state);
      await sendSmsCode(http,iin,password as string,state.fields,answers);
      state.cookies=http.cookies;
      await savePendingSmsLogin(supabase,user.id,state);
      return {connected:false,challenge:{...state.challenge,expiresAt:state.expires,resendAt:now+60000}};
    }
    if ((state.challenge.captcha && !answers.captchaInput) ||
        (state.challenge.twoFactor && answers.twoFactorAuthCode?.length!==4) ||
        (state.challenge.application2FA && answers.application2FACode?.length!==6)) throw new SmsError("invalid_input");
    state.attempts++;
    await savePendingSmsLogin(supabase,user.id,state);
    return await finishLogin(context,http,await submitSmsLogin(http,iin,password as string,state.fields,answers),iin,state);
  } catch (error) {
    const code=safeSmsError(error);
    const retryable=["busy","invalid_input","sms_unavailable","timeout","verification_failed"].includes(code);
    if (retryable && state && http) {
      state.cookies=http.cookies;
      try { await savePendingSmsLogin(supabase,user.id,state); }
      catch { await clearPendingSmsLogin(supabase,user.id).catch(()=>{}); return {connected:false,error:"session_expired"}; }
    }
    if (!retryable) {
      try { await clearPendingSmsLogin(supabase,user.id); } catch { /* The pending cookie is cleared before DB cleanup. */ }
    }
    return {connected:false,error:code,...(retryable && state ? {challenge:{...state.challenge,expiresAt:state.expires,...(state.codeSentAt?{resendAt:state.codeSentAt+60000}:{})}} : {})};
  } finally {
    cleanLoginForm(form);
    active.set(user.id,Date.now()+2000);
  }
}
export async function continueSmsLogin(form: FormData): Promise<SmsResult> { return continueLogin(form,false); }
export async function sendSmsLoginCode(form: FormData): Promise<SmsResult> { return continueLogin(form,true); }
export async function cancelSmsLogin(): Promise<SmsResult> {
  try { const {supabase,user}=await actionContext(); await clearPendingSmsLogin(supabase,user.id); return {connected:false}; }
  catch { return {connected:false,error:"sms_unavailable"}; }
}
export async function refreshSms(selection:SmsDiarySelection={}): Promise<SmsResult> { return operation(false,undefined,selection); }
export async function loadSmsSubject(selection:SmsDiarySelection,subjectId:string):Promise<SmsSubjectDetailResult> {
  let context:Awaited<ReturnType<typeof actionContext>>;
  try{context=await actionContext();}catch{return {error:"session_expired"};}
  const {supabase,user}=context,now=Date.now();
  for(const [id,until] of active)if(until<now)active.delete(id);
  if(active.has(user.id)||active.size>=1000)return {error:"busy"};
  active.set(user.id,now+120000);
  try{
    const session=await readSmsSession(supabase,user.id),http=new SmsHttp(smsConfig(),session.cookies);
    const assessments=await fetchDiarySubject(http,selection,subjectId);
    await saveSmsSession(supabase,user.id,http.cookies,session.expires);
    return {assessments};
  }catch(error){
    const code=safeSmsError(error);
    if(code==="session_expired")try{await clearSmsSession(supabase);}catch{}
    return {error:code};
  }finally{active.set(user.id,Date.now()+2000);}
}
export async function loadRecentSmsWorks(selection:SmsDiarySelection={}):Promise<{works?:SmsAssessment[];error?:SmsErrorCode}> {
  let context:Awaited<ReturnType<typeof actionContext>>;
  try{context=await actionContext();}catch{return {error:"session_expired"};}
  const {supabase,user}=context,now=Date.now();
  for(const [id,until] of active)if(until<now)active.delete(id);
  if(active.has(user.id)||active.size>=1000)return {error:"busy"};
  active.set(user.id,now+120000);
  try{
    const session=await readSmsSession(supabase,user.id),http=new SmsHttp(smsConfig(),session.cookies);
    const works=await fetchRecentWorks(http,selection);
    await saveSmsSession(supabase,user.id,http.cookies,session.expires);
    return {works};
  }catch(error){
    const code=safeSmsError(error);
    if(code==="session_expired")try{await clearSmsSession(supabase);}catch{}
    return {error:code};
  }finally{active.set(user.id,Date.now()+2000);}
}

export async function disconnectSms(): Promise<SmsResult> {
  try { const {supabase,user}=await actionContext();await clearPendingSmsLogin(supabase,user.id);await clearSmsSession(supabase);return {connected:false}; }
  catch { return {connected:false,error:"sms_unavailable"}; }
}
