import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const apiPromise = build({ stdin: { contents: 'export * from "./src/lib/sms/login"; export * from "./src/lib/sms/http";', resolveDir: process.cwd() }, bundle: true, write: false, platform: "node", format: "esm", plugins: [{ name: "server-boundary", setup(builder) {
  builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "fixture" }));
  builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export {};" }));
} }] }).then(async result => await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64")) as typeof import("../src/lib/sms/login") & typeof import("../src/lib/sms/http"));
const origin = "https://sms.ura.nis.edu.kz";
const config = () => ({ origin, loginPath: "/Root/Account/Login?ReturnUrl=%2froot", secret: randomBytes(32), timeoutMs: 1000, maxBytes: 2000000 });
const html = readFileSync("tests/fixtures/sms/login.html", "utf8");
const script = 'name:"login";name:"password";App.buildUrl("LogOn","Account");loginForm.submit(';
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=";
const authenticated = '<script>Ext.apply(App.Server, {"User":{"IsAuthenticated":true}});</script>';
const response = (body: string, type = "text/html", cookie?: string) => new Response(body, { headers: { "content-type": type, ...(cookie ? { "set-cookie": cookie } : {}) } });

test("SMS image challenge resumes the same cookie session without reloading login or storing answers", async () => {
  const { SmsHttp, beginSmsLogin, submitSmsLogin } = await apiPromise;
  const paths: string[] = [], submitted: URLSearchParams[] = [];
  let posts = 0;
  const http = new SmsHttp(config(), [], async (input, init) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    if (path.endsWith("/Login")) return response(html, "text/html", "session=challenge-session; Path=/; HttpOnly");
    assert.match(new Headers(init?.headers).get("cookie") || "", /session=challenge-session/);
    if (path.includes("/res/")) return response(script, "text/javascript");
    if (path.endsWith("/LogOn")) {
      posts++;
      const form = init?.body as URLSearchParams;
      submitted.push(form);
      assert.equal(form.get("login"), "000000000001");
      assert.equal(form.get("password"), "private-password");
      assert.equal(form.get("__RequestVerificationToken"), "synthetic-csrf");
      assert.equal(form.get("captchaInput"), posts === 1 ? "" : "ABC12");
      return response(JSON.stringify(posts === 1 ? { success: false, data: { captchaType: 0, captchaData: png } } : { success: true, data: { url: "/root" } }), "application/json");
    }
    assert.equal(path, "/root");
    return response(authenticated);
  });
  const challenge = await beginSmsLogin(http, "000000000001", "private-password");
  assert.ok(challenge.challenge);
  assert.equal(challenge.challenge.captcha, true);
  assert.equal(challenge.challenge.image, "data:image/png;base64," + png);
  assert.ok(!JSON.stringify(challenge).includes("private-password"));
  const next = await submitSmsLogin(http, "000000000001", "private-password", challenge.fields, { captchaInput: "ABC12" });
  assert.ok(next.page);
  assert.equal(paths.filter(path => path.endsWith("/Login")).length, 1);
  assert.equal(paths.filter(path => path.includes("/res/")).length, 1);
  assert.equal(posts, 2);
  for (const form of submitted) for (const name of ["login", "password", "captchaInput", "twoFactorAuthCode", "application2FACode"]) assert.equal(form.has(name), false);
});

test("SMS inactive flags are ordinary bad credentials; active or unsupported steps are distinguished", async () => {
  const { SmsHttp, submitSmsLogin } = await apiPromise;
  for (const [data, code] of [
    [{ captchaType: 0, needApplication2FA: false }, "bad_credentials"],
    [{ needApplication2FA: false }, "bad_credentials"],
    [{ captchaType: 2, captchaData: png }, "interactive_required"],
    ["NeedChangePassword", "interactive_required"],
    ["TwoFactorAuthInfo", "verification_failed"],
    [{ needApplication2FA: true, qrCodeUrl: "https://private.invalid/enroll" }, "interactive_required"],
  ] as const) {
    const http = new SmsHttp(config(), [], async () => response(JSON.stringify({ success: false, data, message: "PRIVATE_PROVIDER_MESSAGE" }), "application/json"));
    await assert.rejects(submitSmsLogin(http, "000000000001", "private-password", []), error => {
      assert.equal((error as { code: string }).code, code);
      assert.ok(!String(error).includes("PRIVATE"));
      assert.ok(!String(error).includes("private-password"));
      return true;
    });
  }
});

test("SMS authenticator challenge has priority over unrelated captcha type and does not expose enrollment data", async () => {
  const { loginChallenge } = await apiPromise;
  assert.deepEqual(loginChallenge({ needApplication2FA: true, captchaType: 2 }), { captcha: false, twoFactor: false, application2FA: true });
  assert.deepEqual(loginChallenge("TwoFactorAuth"), { captcha: false, twoFactor: true, application2FA: false });
  assert.throws(() => loginChallenge({ needApplication2FA: true, captchaType: 2, qrCodeUrl: "private-enrollment" }), { code: "interactive_required" });
});

test("SMS domain CAPTCHA carries a safe deployment diagnostic without exposing provider data", async () => {
  const { loginChallenge } = await apiPromise;
  try {
    loginChallenge({ captchaType: 2, captchaData: "PRIVATE PROVIDER DATA" });
    assert.fail("must reject a domain-bound CAPTCHA");
  } catch (error) {
    assert.equal((error as { code?: string }).code, "interactive_required");
    assert.equal((error as { reason?: string }).reason, "domain_captcha");
    assert.ok(!String(error).includes("PRIVATE"));
  }
});

test("SMS CAPTCHA accepts bounded PNG data only", async () => {
  const { loginChallenge } = await apiPromise;
  for (const data of ["%%not-base64%%", "data:image/png;base64," + png, Buffer.from("<svg>private script</svg>").toString("base64"), png.replace(/=$/, ""), "a".repeat(350001)]) {
    assert.throws(() => loginChallenge({ captchaType: 0, captchaData: data }), { code: "sms_changed" });
  }
  const dimensions = Buffer.from(png, "base64");
  dimensions.writeUInt32BE(2049, 16);
  assert.throws(() => loginChallenge({ captchaType: 0, captchaData: dimensions.toString("base64") }), { code: "sms_changed" });
});

test("SMS continuations submit 4-digit SMS and 6-digit authenticator codes using official field names", async () => {
  const { SmsHttp, submitSmsLogin } = await apiPromise;
  for (const answers of [{ twoFactorAuthCode: "1234" }, { application2FACode: "123456" }]) {
    let posted: URLSearchParams | undefined;
    const http = new SmsHttp(config(), [{ name: "session", value: "existing", path: "/" }], async (input, init) => {
      const path = new URL(String(input)).pathname;
      assert.match(new Headers(init?.headers).get("cookie") || "", /session=existing/);
      if (path === "/root") return response(authenticated);
      assert.equal(path, "/root/Account/LogOn");
      posted = init?.body as URLSearchParams;
      assert.equal(posted.get("twoFactorAuthCode"), answers.twoFactorAuthCode ?? "");
      assert.equal(posted.get("application2FACode"), answers.application2FACode ?? "");
      return response(JSON.stringify({ success: true, data: { url: "/root" } }), "application/json");
    });
    assert.ok((await submitSmsLogin(http, "000000000001", "private-password", [], answers)).page);
    assert.equal(posted?.has("twoFactorAuthCode"), false);
    assert.equal(posted?.has("application2FACode"), false);
  }
});

test("SMS continuation rejects external success URL before any request or secret disclosure", async () => {
  const { SmsHttp, submitSmsLogin } = await apiPromise;
  let calls = 0;
  const http = new SmsHttp(config(), [], async () => { calls++; return response(JSON.stringify({ success: true, data: { url: "https://evil.invalid/private-password" } }), "application/json"); });
  await assert.rejects(submitSmsLogin(http, "000000000001", "private-password", [], { twoFactorAuthCode: "1234" }), error => {
    assert.equal((error as { code: string }).code, "sms_changed");
    assert.ok(!String(error).includes("private-password"));
    return true;
  });
  assert.equal(calls, 1);
});
