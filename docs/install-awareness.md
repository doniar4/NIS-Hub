# Home Screen installation discovery

## Placement and behavior

- Authenticated Home: compact mobile card immediately below the greeting/date,
  before the existing dashboard. It is not shown on the public welcome screen.
- Shared authenticated shell: small inline reminder above page content, eligible
  from the third visit. Profile, Admin and the PDF Reader exclude the reminder.
  There is no automatic dialog, fixed advertising banner or blocking animation.
- Profile: permanent installation entry below profile settings and above reading
  lists. It remains available after dismissing either promotion and on desktop.
- One shared root controller avoids duplicate browser listeners and state stores.
  A reminder replaces the Home card rather than stacking with it. Navigating away
  removes that reminder; it does not reappear elsewhere in the same session.

## Changed files

- `src/app/layout.tsx` — shared provider and scoped stylesheet.
- `src/app/page.tsx` — authenticated Home card.
- `src/app/profile/page.tsx` — permanent Profile entry.
- `src/components/site-shell.tsx` — authenticated-shell reminder.
- `src/components/install-provider.tsx` — shared browser state/listeners.
- `src/components/install-discovery.tsx` — three discovery points.
- `src/components/install-guide.tsx` — accessible native dialog.
- `src/lib/install-awareness.ts` — storage, platform and installation controller.
- `src/lib/install-copy.ts` — RU/KK/EN strings.
- `src/styles/install.css` — responsive feature styles.
- `tests/install-awareness.test.ts` — focused unit/integration-boundary tests.
- `tests/install-awareness-browser.smoke.ts` — mobile/desktop browser scenarios.
- `tests/browser/install-awareness-harness.tsx` — isolated real-component host.
- `docs/install-awareness.md` — this report and manual verification checklist.

## Storage, visits and dismissal

All keys are versioned, bounded, non-sensitive, local to this browser origin:

| Storage | Key | Value |
| --- | --- | --- |
| localStorage | `nis-install-visits:v1` | Visit count, capped at 999 |
| localStorage | `nis-install-dismissed-until:v1` | Cooldown expiry timestamp |
| localStorage | `nis-install-guide-seen:v1` | Last explicit guide opening timestamp |
| sessionStorage | `nis-install-session-visit:v1` | This session has been counted |
| sessionStorage | `nis-install-reminder-shown:v1` | Reminder already used this session |

A visit means one browsing-tab session, not each route transition or reload.
sessionStorage is used only for per-session markers; there is no backend tracking.
Browser session restore/duplicated tabs may preserve these markers, deliberately
preferring less prompting. No user ID, device fingerprint or browsing history is
stored. The guide-seen value records opening, not successful installation.

“Not now” pauses both Home promotion and reminder for **seven days**. Opening the
guide also pauses promotions for seven days so closing it does not cause another
pitch. The permanent Profile entry is unaffected. Expiry is evaluated on mount,
route changes and browser events; no polling or seven-day timers are added.
Dismissal syncs to other open tabs through the storage event.

Blocked storage never crashes the UI. Automatic reminders are disabled if the
visit/session markers cannot be read or persisted; guide and manual entry points
remain usable. If persistence fails, dismissal still applies in the current
controller, but cannot survive a new document/browser session.

## Platform handling

- iOS Safari: localized Share → Add to Home Screen → Add instructions. Newer
  Safari's Open as Web App switch is mentioned only **if present**.
- Other iOS browsers: short “open in Safari” note; no fake Safari controls or
  programmatic installation. Desktop-mode iPad is recognized via MacIntel and
  touch support. Browser identification is used for instructions, not security.
- Android Chrome: menu → Add to home screen / Install app → confirm, qualified
  by actual menu availability. Other Android browsers receive a Chrome fallback
  note instead of being assumed to use Chrome.
- A valid `beforeinstallprompt` event is retained by the root listener. Its
  one-use `prompt()` is called only by an explicit install-button click. Duplicate
  clicks are blocked while pending. Dismissal or failure falls back to instructions;
  provider exceptions are not displayed or logged. Receiving an event alone
  never opens the prompt. No such prompt is offered on iOS.
- Standalone detection combines `display-mode: standalone`, `minimal-ui`,
  `fullscreen`, iOS `navigator.standalone`, and `appinstalled`. Media changes and
  BFCache pageshow are handled. Both promotions disappear and Profile shows an
  installed label. An observed appinstalled remains honored for that open tab.
- A normal browser tab cannot reliably discover an app already installed in
  another browser/session. An accepted prompt alone is not treated as proof of
  completion. OS installation is not simulated by production code.

## Accessibility and visual treatment

Existing Liquid Glass card/button tokens, local app icon, typography and light/dark
colors are reused. The native dialog is a compact safe-area-aware bottom sheet
on phones, centered on desktop. It supports explicit close, Escape, outside click,
Tab/Shift+Tab containment and focus restoration. If a promotion trigger disappears,
focus returns to the main heading without scrolling. Body scroll locking is restored
on cleanup. Motion runs only with `prefers-reduced-motion: no-preference`.
No new libraries, API calls, tables, environment variables or service workers.

User copy is centralized in `src/lib/install-copy.ts` for RU/KK/EN; it avoids
technical installation terminology. Assets remain `/icons/icon-192.png`, the
existing manifest and apple-touch-icon; none required changes.

## Validation

Baseline: 198 tests, typecheck, lint and build passed before implementation.
Focused unit tests: `node --import tsx --test tests/install-awareness.test.ts`
(14 tests), covering visit counting, cooldown, storage failures, platform handling,
standalone signals, once/session behavior, event cleanup, explicit one-use prompt,
failure fallback, localization and server-page composition.

Browser integration:
`node --import tsx --test tests/install-awareness-browser.smoke.ts`
uses the **actual feature components and production styles**, with only Next's
routing boundary and browser installation/storage signals substituted in an
isolated harness. It does not bypass real authentication, use production data or
claim a real OS installation. Mobile Chromium (Pixel 7) and WebKit (iPhone 13)
pass RU/KK/EN, light/dark, 390/320px, focus/Escape/backdrop/scroll restoration,
standalone, first/third visits, dismissal, unavailable storage, once/session,
Profile-to-Home transition and reduced motion. Native Android event behavior,
non-Safari iOS, other Android browsers and desktop Profile are also covered.
No API requests or JavaScript errors occurred in the feature flows.

Screenshots are local, ignored artifacts under `test-results/install-awareness/`;
they contain no personal data and are not committed.

Full validation: 212 tests passed, none skipped; typecheck, lint and production
build passed. Built public icon/manifest metadata is checked separately with
`node --import tsx --test tests/home-screen-icons.smoke.ts`.

## Remaining real-device verification (after an owner-approved deployment)

1. Sign in normally on iPhone Safari and Android Chrome; inspect the Home card
   and permanent Profile entry. No auth, schedule or homework flow was changed.
2. Open the guide, close it and check promotion stays hidden. The Profile entry
   should still work. Confirm behavior across three separate tab sessions.
3. On actual Safari, use Share → Add to Home Screen; confirm the NIS Hub name,
   existing icon, standalone launch and safe area with the dynamic address bar.
4. On actual Android Chrome, use the offered install action if available;
   otherwise follow the menu steps. Native availability is controlled by Chrome.
5. Reopen via the installed icon: neither promotion should appear; Profile shows
   the installed state. Check both themes and preferred locale.

Playwright WebKit is not a physical iPhone and cannot verify OS home-screen menus,
real installation completion or iOS browser chrome. Authenticated production
Home/Profile placement still needs the owner's normal session after deployment.
No push, merge, deployment or production migration was performed.
