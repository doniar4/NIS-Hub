# Mobile Safari Schedule gray-frame investigation

Date: 2026-10-06 (Asia/Oral).

## Repository and scope

- Started with a clean `codex/inline-schedule-homework` at `db7ecdd579ed00240e291006e96d75f13905b85d`.
- Fetched `origin/main`: `861d943`. Its tree is identical to this starting tree.
- No schedule/homework/auth/Telegram/RLS/database changes, migrations or deployment.
- Only production code changed: `src/components/ui/velaris.tsx`.
- Tests: `tests/velaris-resize.test.ts`, `tests/mobile-schedule-scroll-browser.smoke.ts`, `tests/browser/mobile-schedule-scroll-harness.tsx`.

## Evidence and root cause

Inspected `mobile.css`, `globals.css`, shell/environment/material/page styles, root layout, AppFrame, SmoothScroll, ParallaxBackground/Velaris, and drawer/lesson-dialog/menu/notification lifecycles. The drawer uses a native dialog, initially closed, opened by a button. Scroll does not open it. Content ancestors are not transformed or filtered; decorative card pseudo-elements are disabled. The fixed animated WebGL background sits behind the application. Its context is opaque (`alpha:false`).

The initial scroll-only checks did not reproduce an unintended DOM overlay. A screenshot during the viewport-height resize sequence **did** show a gray lesson panel while navigation stayed normal. A pixel guard reproduced it in WebKit when changing 390×844 to 390×700 (also on return to 844): panel pixel `120,121,122`. No dialog was open and no viewport-sized foreground overlay was mounted. Diagnostics at that checkpoint reported a black canvas sample `0,0,0,255`, no lost context, and a translucent white panel fill `rgba(255,255,255,0.48)`.

Velaris's ResizeObserver changed `canvas.width`/`height`, clearing the opaque WebGL drawing buffer, but only redrew on the following animation frame. ResizeObserver delivery after rAF leaves an opportunity for WebKit to composite the cleared background through translucent content. This explains the reproduced gray frame without a real overlay. A black readback alone is not conclusive (WebGL's default drawing buffer is not preserved); the callback ordering, screenshot pixels, and before/after regression provide the stronger evidence.

Experimentally disabling backdrop filters on the persistent mobile chrome, nested controls, and then the long lesson panel did **not** eliminate the gray pixel failure. All experimental CSS was removed. `mobile.css` and all other CSS are unchanged. Backdrop filtering exposes/amplifies the background issue but was not the demonstrated primary cause.

## Final fix

1. Skip canvas dimension assignments when the physical dimensions have not changed; even assigning an unchanged canvas dimension clears its buffer.
2. Track whether shader uniforms have been initialized by a completed render.
3. After a real resize, immediately update the resolution uniform and redraw using the current program/uniforms, in the ResizeObserver callback itself. Do not wait for another rAF and do not draw with uninitialized uniforms.

No UA detection, CSS engine hack, global blur removal, GPU-forcing transform, z-index change, DOM change, or visual redesign. Existing animation, DPR cap, safe-area styling and Liquid Glass remain intact on every browser. React review: this stays within the existing effect, adds no React state/subscriptions/dependencies, and avoids redundant buffer allocations.

## Verification

- Baseline: typecheck/lint passed; 175 tests passed.
- Final: `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` passed. Full tests: 176 passed, zero failures/skips/todos. Reader regression used the existing `nis-hub-reader-test.pdf` via `NIS_READER_TEST_PDF`; no PDF/data added to the repository.
- Unit regression executes the actual Velaris component at a mocked lifecycle/WebGL boundary: capped DPR, no uninitialized draw, synchronous redraw after resize, no clears on unchanged dimensions, normal animation and observer cleanup.
- Playwright regression uses actual AppFrame, StudentSchedule, theme controls, SmoothScroll and WebGL background with existing safe project class/subject fixtures and isolated homework action responses. It does **not** claim authenticated production-service verification.
- WebKit and Chromium: 320/390px, light/dark, near-top/bottom scrolling and rapid direction changes, viewport heights 700/844, day tabs, drawer open/close/focus/scroll-lock cleanup, fixed bottom navigation, sticky topbar, no horizontal overflow, stable lesson positions across height changes, no page exceptions. Screenshots sample lesson-panel colors during scroll and immediately after viewport resizing, not just DOM overlay presence. Desktop 1280px still has backdrop blur.
- Final mobile scroll regression also repeated three times in both engines. Existing inline-homework browser regression passed in both engines.

Commands:

```sh
npm run typecheck
npm run lint
NIS_READER_TEST_PDF=/path/to/nis-hub-reader-test.pdf npm test
npm run build
node --import tsx --test tests/mobile-schedule-scroll-browser.smoke.ts
node --import tsx --test tests/inline-homework-browser.smoke.ts
```

Ignored artifacts: `test-results/mobile-schedule-scroll/` (light/dark screenshots for both engines at both widths; `gray-repaint-failure.png` from investigation). No personal data is included.

## Real-device limitations / manual check

Desktop Playwright WebKit is not hardware iOS Safari. Viewport resizing is a proxy for dynamic browser chrome, and frame-to-frame programmatic scrolling is not an actual inertial touch flick. Emulated safe-area values are zero; the existing nonzero-inset rules are unchanged, not hardware-verified. The provided symptom is consistent with the reproduced fault, but equivalence to the user's particular iOS/video cannot be proven here.

On a real iPhone, after deploying through the owner's normal process, open Schedule in light/dark, flick slowly/quickly in both directions, expand/collapse the Safari address bar, scroll to both edges, change day, and open/close the drawer. Confirm no gray frame, usable topbar, fixed bottom navigation above the home indicator, and no jumping/overflow. No automatic deployment was performed.
