import "server-only";
import { SmsError } from "./errors";
import { SmsHttp, safeSmsUrl } from "./http";
import { attr, document, nodes, serverState } from "./html";
export function validCredentials(iin: unknown, password: unknown): iin is string {
  return typeof iin === "string" && /^\d{12}$/.test(iin) && typeof password === "string" && password.length >= 1 && password.length <= 256;
}
export async function loginSms(http: SmsHttp, iin: string, password: string): Promise<{body: string; url: URL}> {
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
  // Verified network field names; challenge values are empty in the ordinary flow.
  for (const name of ["twoFactorAuthCode","captchaInput","application2FACode"]) form.set(name,"");
  form.set("login", iin); form.set("password", password);
  let result;
  try { result = await http.request("/root/Account/LogOn", form, "login"); }
  finally { form.delete("login"); form.delete("password"); iin = ""; password = ""; }
  if (result.type.includes("json") || /^\s*\{/.test(result.body)) {
    let json: {success?: boolean; data?: unknown};
    try { json = JSON.parse(result.body); } catch { throw new SmsError("sms_changed"); }
    if (json.success !== true) {
      const data = json.data;
      if (["NeedChangePassword","TwoFactorAuth","TwoFactorAuthInfo"].includes(String(data)) ||
        (data && typeof data === "object" && ("needApplication2FA" in data || "captchaType" in data))) throw new SmsError("interactive_required");
      throw new SmsError("bad_credentials");
    }
    const data = json.data;
    if (!data || typeof data !== "object" || !("url" in data) || typeof data.url !== "string") throw new SmsError("sms_changed");
    result = await http.request(safeSmsUrl(data.url, http.config.origin, result.url.href).href);
  }
  if (serverState(result.body)?.User?.IsAuthenticated !== true || /\/account\/login/i.test(result.url.pathname)) throw new SmsError("bad_credentials");
  return result;
}
