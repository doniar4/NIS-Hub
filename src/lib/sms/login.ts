import "server-only";
import { SmsError } from "./errors";
import { SmsHttp, safeSmsUrl } from "./http";
import { attr, document, nodes, serverState } from "./html";
export type SmsChallengeFlags = { captcha: boolean; twoFactor: boolean; application2FA: boolean; image?: string };
export type SmsLoginStep = { page: {body: string; url: URL}; challenge?: never; fields?: never } | {page?: never; challenge: SmsChallengeFlags; fields: [string,string][]};
export type SmsLoginAnswers = { captchaInput?: string; twoFactorAuthCode?: string; application2FACode?: string };
export function validCredentials(iin: unknown, password: unknown): iin is string {
  return typeof iin === "string" && /^\d{12}$/.test(iin) && typeof password === "string" && password.length >= 1 && password.length <= 256;
}
export async function beginSmsLogin(http: SmsHttp, iin: string, password: string): Promise<SmsLoginStep> {
  if (!validCredentials(iin, password)) throw new SmsError("invalid_input");
  const page = await http.request(http.config.loginPath);
  const root = document(page.body), state = serverState(page.body);
  // Verified on 2026-09-20 from rendered login + public ExtJS resource.
  if (state?.Area !== "root" || state.ApplicationPath !== "/" || state.User?.IsAuthenticated !== false) throw new SmsError("sms_changed");
  const scripts = nodes(root, "script").map(n => attr(n, "src")).filter((s): s is string => !!s && /\/res\/login\/index\//.test(s));
  if (scripts.length !== 1) throw new SmsError("sms_changed");
  const script = await http.request(safeSmsUrl(scripts[0], http.config.origin, page.url.href).href, undefined, "script");
  for (const signature of ['name:"login"', 'name:"password"', 'App.buildUrl("LogOn","Account")', 'loginForm.submit(']) {
    if (!script.body.includes(signature)) throw new SmsError("sms_changed");
  }
  const form = new URLSearchParams();
  for (const input of nodes(root, "input")) {
    if (attr(input,"type")?.toLowerCase() !== "hidden" || attr(input,"disabled") !== undefined) continue;
    const name = attr(input,"name");
    if (name && !["login","password"].includes(name)) form.append(name, attr(input,"value") || "");
  }
  for (const name of ["twoFactorAuthCode","captchaInput","application2FACode"]) form.delete(name);
  return submitSmsLogin(http, iin, password, [...form.entries()]);
}

export async function submitSmsLogin(http: SmsHttp, iin: string, password: string, fields: [string,string][], answers: SmsLoginAnswers = {}): Promise<SmsLoginStep> {
  if (!validCredentials(iin, password)) throw new SmsError("invalid_input");
  const form = new URLSearchParams(fields);
  // These are the field names used by the official SMS login form.
  for (const name of ["twoFactorAuthCode","captchaInput","application2FACode"] as const) {
    const value = answers[name] ?? "";
    if (typeof value !== "string" || value.length > 128 || /[\x00-\x1f\x7f]/.test(value)) throw new SmsError("invalid_input");
    form.set(name, value);
  }
  form.set("login", iin); form.set("password", password);
  let result;
  try { result = await http.request("/root/Account/LogOn", form, "login"); }
  finally { for (const name of ["login","password","twoFactorAuthCode","captchaInput","application2FACode"]) form.delete(name); iin = ""; password = ""; }
  if (result.type.includes("json") || /^\s*\{/.test(result.body)) {
    let json: {success?: boolean; data?: unknown};
    try { json = JSON.parse(result.body); } catch { throw new SmsError("sms_changed"); }
    if (!json || typeof json !== "object" || Array.isArray(json)) throw new SmsError("sms_changed");
    if (json.success !== true) {
      const data = json.data;
      if (data === "NeedChangePassword") throw new SmsError("interactive_required", "password_change");
      if (data === "TwoFactorAuthInfo") throw new SmsError("verification_failed");
      const challenge = loginChallenge(data);
      if (challenge) return {challenge, fields};
      throw new SmsError("bad_credentials");
    }
    const data = json.data;
    if (!data || typeof data !== "object" || !("url" in data) || typeof data.url !== "string") throw new SmsError("sms_changed");
    result = await http.request(safeSmsUrl(data.url, http.config.origin, result.url.href).href);
  }
  if (serverState(result.body)?.User?.IsAuthenticated !== true || /\/account\/login/i.test(result.url.pathname)) throw new SmsError("bad_credentials");
  return {page: result};
}

export function loginChallenge(data: unknown): SmsChallengeFlags | undefined {
  const flags: SmsChallengeFlags = {captcha: false, twoFactor: data === "TwoFactorAuth", application2FA: false};
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const value = data as Record<string,unknown>;
    flags.application2FA = value.needApplication2FA === true;
    if (flags.application2FA) {
      if (value.qrCodeUrl) throw new SmsError("interactive_required", "authenticator_enrollment");
      return flags;
    }
    // Verified public SMS login client: type 2 uses a domain-bound Google widget;
    // all other types use captchaData as a PNG (including type 0).
    if (value.captchaType === 2 || value.captchaType === "2") throw new SmsError("interactive_required", "domain_captcha");
    if (typeof value.captchaData === "string" && value.captchaData.length) {
      const raw = value.captchaData;
      if (raw.length > 350000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new SmsError("sms_changed");
      const bytes = Buffer.from(raw, "base64");
      if (bytes.length < 24 || bytes.toString("base64") !== raw || bytes.subarray(0,8).toString("hex") !== "89504e470d0a1a0a" || bytes.subarray(12,16).toString("ascii") !== "IHDR") throw new SmsError("sms_changed");
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
      if (!width || !height || width > 2048 || height > 2048) throw new SmsError("sms_changed");
      flags.captcha = true;
      flags.image = "data:image/png;base64," + raw;
    } else if (value.captchaType !== undefined && value.captchaType !== null && value.captchaType !== false && value.captchaType !== 0) {
      throw new SmsError("interactive_required", "unknown_challenge");
    }
  }
  return flags.captcha || flags.twoFactor || flags.application2FA ? flags : undefined;
}

export async function refreshSmsCaptcha(http: SmsHttp): Promise<SmsChallengeFlags> {
  const response = await http.request("/root/Account/RefreshRestoreCaptcha",undefined,"json");
  let json;
  try { json = JSON.parse(response.body); } catch { throw new SmsError("sms_changed"); }
  if (json?.success !== true) throw new SmsError("sms_unavailable");
  const challenge=loginChallenge(json.data);
  if (!challenge?.captcha || !challenge.image) throw new SmsError("sms_changed");
  return challenge;
}

export async function sendSmsCode(http: SmsHttp, iin: string, password: string, fields: [string,string][], answers: SmsLoginAnswers): Promise<void> {
  if (!validCredentials(iin,password)) throw new SmsError("invalid_input");
  const form = new URLSearchParams(fields);
  form.set("login",iin); form.set("password",password);
  for (const name of ["twoFactorAuthCode","captchaInput","application2FACode"] as const) form.set(name,answers[name] ?? "");
  try {
    // The verified SMS client starts its cooldown after any successful HTTP
    // callback and does not depend on a response envelope.
    await http.request("/root/Account/SendTwoFactorAuthCode",form,"login");
  } finally {
    for (const name of ["login","password","twoFactorAuthCode","captchaInput","application2FACode"]) form.delete(name);
  }
}

// Keep the non-interactive helper for callers that cannot present challenges.
export async function loginSms(http: SmsHttp, iin: string, password: string): Promise<{body: string; url: URL}> {
  const step = await beginSmsLogin(http, iin, password);
  if (step.challenge) throw new SmsError("interactive_required", "manual_challenge");
  return step.page;
}
