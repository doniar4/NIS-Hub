export const INSTALL_COOLDOWN = 7 * 24 * 60 * 60 * 1000;
export const INSTALL_KEYS = {
  visits: "nis-install-visits:v1",
  dismissed: "nis-install-dismissed-until:v1",
  guide: "nis-install-guide-seen:v1",
  visit: "nis-install-session-visit:v1",
  shown: "nis-install-reminder-shown:v1",
} as const;
export type InstallPlatform =
  "ios-safari" | "ios-other" | "android-chrome" | "android-other" | "desktop";
type Store = Pick<Storage, "getItem" | "setItem">;
export interface NativeInstallEvent extends Event {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export type InstallSnapshot = {
  ready: boolean;
  mobile: boolean;
  installed: boolean;
  platform: InstallPlatform;
  visits: number;
  dismissedUntil: number;
  checkedAt: number;
  canRemind: boolean;
  reminderUsed: boolean;
  reminderPath: string | null;
  guideOpen: boolean;
  nativeAvailable: boolean;
  busy: boolean;
  promptFailed: boolean;
};
export const INITIAL_INSTALL: InstallSnapshot = {
  ready: false,
  mobile: false,
  installed: false,
  platform: "desktop",
  visits: 0,
  dismissedUntil: 0,
  checkedAt: 0,
  canRemind: false,
  reminderUsed: false,
  reminderPath: null,
  guideOpen: false,
  nativeAvailable: false,
  busy: false,
  promptFailed: false,
};

export function installPlatform(
  ua: string,
  platform = "",
  touches = 0,
): InstallPlatform {
  const ios =
    /iPhone|iPad|iPod/i.test(ua) || (platform === "MacIntel" && touches > 1);
  if (ios)
    return /Version\/[\d.]+.*Safari\//i.test(ua) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo|FBAN|FBAV|Instagram|YaBrowser/i.test(
        ua,
      )
      ? "ios-safari"
      : "ios-other";
  if (/Android/i.test(ua))
    return /Chrome\//i.test(ua) &&
      !/EdgA|OPR|SamsungBrowser|UCBrowser|YaBrowser|; wv\)/i.test(ua)
      ? "android-chrome"
      : "android-other";
  return "desktop";
}
function integer(value: string | null, max: number) {
  const n = value === null ? 0 : Number(value);
  return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : 0;
}
export function readInstallVisit(local: Store | null, session: Store | null) {
  try {
    if (!local || !session) throw new Error("storage_unavailable");
    let visits = integer(local.getItem(INSTALL_KEYS.visits), 999);
    const dismissedUntil = integer(
      local.getItem(INSTALL_KEYS.dismissed),
      Number.MAX_SAFE_INTEGER,
    );
    if (session.getItem(INSTALL_KEYS.visit) !== "1") {
      visits = Math.min(999, visits + 1);
      local.setItem(INSTALL_KEYS.visits, String(visits));
      session.setItem(INSTALL_KEYS.visit, "1");
    }
    return {
      visits,
      dismissedUntil,
      canRemind: true,
      reminderUsed: session.getItem(INSTALL_KEYS.shown) === "1",
    };
  } catch {
    return {
      visits: 0,
      dismissedUntil: 0,
      canRemind: false,
      reminderUsed: false,
    };
  }
}
export function reminderEligible(s: InstallSnapshot, now: number) {
  return (
    s.ready &&
    s.mobile &&
    !s.installed &&
    s.canRemind &&
    s.visits >= 3 &&
    s.dismissedUntil <= now &&
    !s.reminderUsed &&
    !s.guideOpen
  );
}
export function promotionVisible(s: InstallSnapshot, now: number) {
  return (
    s.ready &&
    s.mobile &&
    !s.installed &&
    s.dismissedUntil <= now &&
    !s.guideOpen
  );
}

// Feature-local external store: one instance per root provider, no shared SSR
// state, user identifiers, backend calls, timers, polling or analytics SDK.
export function createInstallController(clock: () => number = Date.now) {
  let state = INITIAL_INSTALL,
    local: Store | null = null,
    session: Store | null = null,
    native: NativeInstallEvent | null = null,
    path = "",
    opener: HTMLElement | null = null,
    installationObserved = false;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<InstallSnapshot>) => {
    state = { ...state, checkedAt: clock(), ...patch };
    for (const notify of listeners) notify();
  };
  const pause = () => {
    const until = clock() + INSTALL_COOLDOWN;
    try {
      local?.setItem(INSTALL_KEYS.dismissed, String(until));
    } catch {
      /* Memory cooldown still applies when storage is blocked. */
    }
    emit({ dismissedUntil: until, reminderPath: null, reminderUsed: true });
  };
  return {
    subscribe: (notify: () => void) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    snapshot: () => state,
    serverSnapshot: () => INITIAL_INSTALL,
    mount(win: Window) {
      try {
        local = win.localStorage;
      } catch {
        local = null;
      }
      try {
        session = win.sessionStorage;
      } catch {
        session = null;
      }
      const nav = win.navigator as Navigator & { standalone?: boolean };
      const platform = installPlatform(
        nav.userAgent,
        nav.platform,
        nav.maxTouchPoints,
      );
      const modes = ["standalone", "fullscreen", "minimal-ui"].map((mode) =>
        win.matchMedia(`(display-mode: ${mode})`),
      );
      const installed = () =>
        installationObserved ||
        nav.standalone === true ||
        modes.some((m) => m.matches);
      emit({
        ...(!installed() ? readInstallVisit(local, session) : {}),
        ready: true,
        platform,
        mobile: platform !== "desktop",
        installed: installed(),
      });
      const modeChange = () => {
        const isInstalled = installed();
        if (isInstalled) native = null;
        emit({
          installed: isInstalled,
          ...(isInstalled
            ? { guideOpen: false, reminderPath: null, nativeAvailable: false }
            : {}),
        });
      };
      const before = (event: Event) => {
        const candidate = event as NativeInstallEvent;
        if (
          installed() ||
          platform.startsWith("ios") ||
          typeof candidate.prompt !== "function" ||
          !candidate.userChoice?.then
        )
          return;
        event.preventDefault();
        native = candidate;
        emit({ nativeAvailable: true, promptFailed: false });
      };
      const completed = () => {
        installationObserved = true;
        native = null;
        emit({
          installed: true,
          guideOpen: false,
          reminderPath: null,
          nativeAvailable: false,
        });
      };
      const storage = (event: StorageEvent) => {
        if (event.key === INSTALL_KEYS.dismissed)
          emit({
            dismissedUntil: integer(event.newValue, Number.MAX_SAFE_INTEGER),
            reminderPath: null,
          });
      };
      const sync = () => {
        modeChange();
      };
      for (const mode of modes) mode.addEventListener("change", modeChange);
      win.addEventListener("beforeinstallprompt", before);
      win.addEventListener("appinstalled", completed);
      win.addEventListener("storage", storage);
      win.addEventListener("pageshow", sync);
      return () => {
        for (const mode of modes)
          mode.removeEventListener("change", modeChange);
        win.removeEventListener("beforeinstallprompt", before);
        win.removeEventListener("appinstalled", completed);
        win.removeEventListener("storage", storage);
        win.removeEventListener("pageshow", sync);
      };
    },
    routeChanged(next: string) {
      if (path !== next) {
        path = next;
        emit({ reminderPath: null, guideOpen: false });
      }
    },
    claimReminder(currentPath: string) {
      if (!reminderEligible(state, clock())) return;
      try {
        if (!session) throw new Error("storage_unavailable");
        session.setItem(INSTALL_KEYS.shown, "1");
      } catch {
        emit({ canRemind: false });
        return;
      }
      emit({ reminderUsed: true, reminderPath: currentPath });
    },
    dismiss() {
      pause();
    },
    openGuide(trigger?: HTMLElement) {
      if (!state.ready || state.installed) return;
      opener = trigger ?? null;
      pause();
      try {
        local?.setItem(INSTALL_KEYS.guide, String(clock()));
      } catch {}
      emit({ guideOpen: true, promptFailed: false });
    },
    guideOpener: () => opener,
    closeGuide() {
      emit({ guideOpen: false });
    },
    async install() {
      if (!native || state.busy || state.installed) return;
      const event = native;
      native = null;
      emit({ busy: true, promptFailed: false });
      try {
        await event.prompt();
        await event.userChoice;
      } catch {
        emit({ promptFailed: true });
      } finally {
        emit({ busy: false, nativeAvailable: false });
      }
    },
  };
}
export type InstallController = ReturnType<typeof createInstallController>;
