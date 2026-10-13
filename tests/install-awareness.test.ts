import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createInstallController,
  INITIAL_INSTALL,
  INSTALL_COOLDOWN,
  INSTALL_KEYS,
  installPlatform,
  promotionVisible,
  readInstallVisit,
  reminderEligible,
} from "../src/lib/install-awareness";
import { installCopy } from "../src/lib/install-copy";

const safari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1";
const chrome =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
class MemoryStore {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
function fixture(ua = chrome, standalone = false, iosStandalone = false) {
  const win = new EventTarget() as EventTarget & Record<string, unknown>;
  const local = new MemoryStore(),
    session = new MemoryStore();
  const modes = new Map<string, EventTarget & { matches: boolean }>();
  Object.assign(win, {
    localStorage: local,
    sessionStorage: session,
    navigator: {
      userAgent: ua,
      platform: "",
      maxTouchPoints: 1,
      standalone: iosStandalone,
    },
    matchMedia: (query: string) => {
      const media = Object.assign(new EventTarget(), {
        matches: query === "(display-mode: standalone)" && standalone,
      });
      modes.set(query, media);
      return media;
    },
  });
  return { win: win as unknown as Window, local, session, modes };
}
function promptEvent(
  prompt: () => Promise<unknown>,
  outcome: "accepted" | "dismissed" = "dismissed",
) {
  return Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
}

test("installation platform: Safari, other iOS, desktop-mode iPad, Chrome and other Android", () => {
  assert.equal(installPlatform(safari), "ios-safari");
  assert.equal(
    installPlatform(safari.replace("Version/18.0", "CriOS/130.0")),
    "ios-other",
  );
  assert.equal(installPlatform(safari + " EdgiOS/130"), "ios-other");
  assert.equal(
    installPlatform("Mozilla Macintosh Version/18.0 Safari/605", "MacIntel", 5),
    "ios-safari",
  );
  assert.equal(installPlatform(chrome), "android-chrome");
  for (const suffix of [" SamsungBrowser/26", " OPR/90", " EdgA/120", "; wv)"])
    assert.equal(installPlatform(chrome + suffix), "android-other");
  assert.equal(
    installPlatform("Macintosh Version/18.0 Safari/605", "MacIntel", 0),
    "desktop",
  );
});
test("visits count once per browsing session, not route switches/reloads, reminder starts at third", () => {
  const local = new MemoryStore();
  for (let visit = 1; visit <= 3; visit++) {
    const session = new MemoryStore(),
      first = readInstallVisit(local, session),
      second = readInstallVisit(local, session);
    assert.equal(first.visits, visit);
    assert.equal(second.visits, visit);
    assert.equal(
      reminderEligible(
        { ...INITIAL_INSTALL, ...first, ready: true, mobile: true },
        100,
      ),
      visit >= 3,
    );
  }
});
test("missing, corrupted or unavailable storage fails safely without reminder", () => {
  assert.equal(readInstallVisit(null, new MemoryStore()).canRemind, false);
  const denied = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  assert.equal(readInstallVisit(denied, new MemoryStore()).canRemind, false);
  assert.equal(readInstallVisit(new MemoryStore(), denied).canRemind, false);
  const corrupted = new MemoryStore();
  corrupted.setItem(INSTALL_KEYS.visits, "NaN");
  corrupted.setItem(INSTALL_KEYS.dismissed, "-20");
  assert.equal(readInstallVisit(corrupted, new MemoryStore()).visits, 1);
});
test("Home card is mobile-only; both promotions hidden in standalone or cooldown", () => {
  const mobile = {
    ...INITIAL_INSTALL,
    ready: true,
    mobile: true,
    canRemind: true,
    visits: 3,
  };
  assert.equal(promotionVisible(mobile, 100), true);
  for (const patch of [
    { installed: true },
    { mobile: false },
    { dismissedUntil: 200 },
    { guideOpen: true },
  ]) {
    assert.equal(promotionVisible({ ...mobile, ...patch }, 100), false);
    assert.equal(reminderEligible({ ...mobile, ...patch }, 100), false);
  }
});
test("standalone detected independently from display mode and iOS navigator; no visit increment", () => {
  for (const [display, ios] of [
    [true, false],
    [false, true],
  ]) {
    const f = fixture(safari, display, ios),
      c = createInstallController(),
      dispose = c.mount(f.win);
    assert.equal(c.snapshot().installed, true);
    assert.equal(c.snapshot().visits, 0);
    c.openGuide();
    assert.equal(c.snapshot().guideOpen, false);
    dispose();
  }
});
test("media changes/appinstalled hide promotions; pageshow cannot undo installation observed in this tab", () => {
  const f = fixture(),
    c = createInstallController(),
    dispose = c.mount(f.win);
  const mode = f.modes.get("(display-mode: standalone)")!;
  mode.matches = true;
  mode.dispatchEvent(new Event("change"));
  assert.equal(c.snapshot().installed, true);
  mode.matches = false;
  mode.dispatchEvent(new Event("change"));
  assert.equal(c.snapshot().installed, false);
  f.win.dispatchEvent(new Event("appinstalled"));
  f.win.dispatchEvent(new Event("pageshow"));
  assert.equal(c.snapshot().installed, true);
  dispose();
});
test("reminder once per session, navigation hides it, no repeat after remount", () => {
  const f = fixture();
  f.local.setItem(INSTALL_KEYS.visits, "2");
  const c = createInstallController(() => 100),
    dispose = c.mount(f.win);
  c.routeChanged("/");
  c.claimReminder("/");
  assert.equal(c.snapshot().reminderPath, "/");
  assert.equal(f.session.getItem(INSTALL_KEYS.shown), "1");
  c.routeChanged("/schedule");
  c.claimReminder("/schedule");
  assert.equal(c.snapshot().reminderPath, null);
  dispose();
  const returning = createInstallController(() => 100),
    cleanup = returning.mount(f.win);
  returning.claimReminder("/");
  assert.equal(returning.snapshot().reminderPath, null);
  cleanup();
});
test("dismissal persists a 7-day cooldown; expiry eligible only in a new session", () => {
  let now = 100;
  const f = fixture(),
    c = createInstallController(() => now),
    dispose = c.mount(f.win);
  c.dismiss();
  assert.equal(c.snapshot().dismissedUntil, 100 + INSTALL_COOLDOWN);
  assert.equal(
    f.local.getItem(INSTALL_KEYS.dismissed),
    String(100 + INSTALL_COOLDOWN),
  );
  assert.equal(promotionVisible(c.snapshot(), now), false);
  now += INSTALL_COOLDOWN;
  assert.equal(promotionVisible(c.snapshot(), now), true);
  assert.equal(reminderEligible(c.snapshot(), now), false);
  dispose();
});
test("Profile guide survives unavailable localStorage; dismiss still works in memory", () => {
  const f = fixture(safari);
  Object.defineProperty(f.win, "localStorage", {
    get() {
      throw new Error("blocked");
    },
  });
  const c = createInstallController(() => 100),
    dispose = c.mount(f.win);
  assert.equal(c.snapshot().canRemind, false);
  c.openGuide();
  assert.equal(c.snapshot().guideOpen, true);
  assert.equal(c.snapshot().dismissedUntil, 100 + INSTALL_COOLDOWN);
  c.closeGuide();
  assert.equal(c.snapshot().guideOpen, false);
  dispose();
});
test("native prompt never automatic, only explicit installation; duplicate clicks cannot reuse it", async () => {
  const f = fixture(),
    c = createInstallController(),
    dispose = c.mount(f.win);
  let calls = 0,
    finish!: () => void;
  const event = promptEvent(() => {
    calls++;
    return new Promise<void>((r) => {
      finish = r;
    });
  }, "accepted");
  f.win.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(c.snapshot().nativeAvailable, true);
  assert.equal(calls, 0);
  const pending = c.install();
  await c.install();
  assert.equal(calls, 1);
  assert.equal(c.snapshot().busy, true);
  finish();
  await pending;
  assert.equal(
    c.snapshot().installed,
    false,
    "accepting alone is not proof of completed installation",
  );
  assert.equal(c.snapshot().nativeAvailable, false);
  await c.install();
  assert.equal(calls, 1);
  dispose();
});
test("native failure gracefully falls back; iOS and malformed prompt events ignored", async () => {
  const f = fixture(),
    c = createInstallController(),
    dispose = c.mount(f.win);
  f.win.dispatchEvent(
    promptEvent(async () => {
      throw new Error("browser_failure");
    }),
  );
  await c.install();
  assert.equal(c.snapshot().promptFailed, true);
  assert.equal(c.snapshot().busy, false);
  assert.equal(c.snapshot().nativeAvailable, false);
  dispose();
  for (const ua of [safari, safari.replace("Version/18.0", "CriOS/130")]) {
    const ios = fixture(ua),
      controller = createInstallController(),
      cleanup = controller.mount(ios.win);
    ios.win.dispatchEvent(promptEvent(async () => {}));
    assert.equal(controller.snapshot().nativeAvailable, false);
    cleanup();
  }
  const malformed = fixture(),
    other = createInstallController(),
    cleanup = other.mount(malformed.win);
  malformed.win.dispatchEvent(new Event("beforeinstallprompt"));
  assert.equal(other.snapshot().nativeAvailable, false);
  cleanup();
});
test("listener cleanup removes native install and media subscriptions", () => {
  const f = fixture(),
    c = createInstallController(),
    dispose = c.mount(f.win);
  dispose();
  const snapshot = c.snapshot();
  f.win.dispatchEvent(new Event("appinstalled"));
  f.win.dispatchEvent(promptEvent(async () => {}));
  assert.equal(c.snapshot(), snapshot);
});
test("RU/KK/EN copy is complete, no user-facing technical jargon; correct platform instructions", () => {
  for (const locale of ["ru", "kk", "en"] as const) {
    const t = installCopy(locale);
    assert.deepEqual(Object.keys(t), Object.keys(installCopy("ru")));
    assert.equal(t.ios.length, 3);
    assert.equal(t.android.length, 3);
    assert.match(t.ios[0], /Safari/);
    assert.match(t.safariNote, /Safari/);
    assert.match(t.android[0], /Chrome/);
    assert.ok(!/\bPWA\b/.test(JSON.stringify(t)));
    for (const value of Object.values(t))
      assert.ok(
        typeof value === "string"
          ? value.length > 0
          : value.every((item: string) => item.length > 0),
      );
  }
});
test("composition uses one shared provider and existing icon; no backend or manifest/branding change", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  assert.match(
    read("src/app/layout.tsx"),
    /<InstallProvider>\{children\}<\/InstallProvider>/,
  );
  assert.match(read("src/app/page.tsx"), /<InstallHomeCard\/>/);
  assert.match(read("src/app/profile/page.tsx"), /<InstallProfileEntry \/>/);
  assert.match(
    read("src/components/site-shell.tsx"),
    /viewer.user && <InstallReminder \/>/,
  );
  const client = [
    "src/lib/install-awareness.ts",
    "src/components/install-discovery.tsx",
    "src/components/install-guide.tsx",
    "src/components/install-provider.tsx",
  ]
    .map(read)
    .join("\n");
  assert.doesNotMatch(
    client,
    /fetch\(|supabase|\/api\/|service.role|setInterval/,
  );
  assert.match(client, /\/icons\/icon-192.png/);
  assert.match(read("src/styles/install.css"), /safe-area-inset-bottom/);
  assert.match(read("src/styles/install.css"), /prefers-reduced-motion/);
});
