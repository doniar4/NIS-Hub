# Design QA — community additions, 2026-09-18

## Scope and evidence

- Source visual: `/home/ali/Загрузки/exec-5657f0cb-ed44-4db9-b460-5e5bb238b8fa.png` (2172 × 724, two theme concepts). The later Profile annotation and explicit answer place the avatar beside the heading.
- Existing implementation is the code target. This pass extends its vintage visual system; it is not a pixel clone of the dashboard concept. Profile, Messages and Diary have different content and proportions from that source. Existing botanical artwork was preserved, not recreated in this change.
- Browser: separate headless system Chromium through Playwright, explicitly approved by the user. No personal browser profile used.
- Implementation screenshots: `/tmp/nis-community-browser/profile-light.png`, `profile-dark.png`, `profile-390.png`, `profile-320.png`, `messages-dark.png`, `messages-320.png`, `notifications-dark.png`, `diary-320.png`, `reader.png`.
- CSS viewports: 1280 × 800, 390 × 844, 320 × 844; device scale factor 1. Full-page screenshots are taller when content scrolls. Source is a side-by-side presentation, not a 1:1 viewport; no pixel-level fidelity score is claimed.
- Actual production client components and compiled production CSS are rendered by `tests/browser/community-harness.tsx`. Profile form content is representative test data. Server-action transport is replaced by an isolated PostgreSQL fixture using the real migrations and RPCs. Cloud authentication, Supabase HTTP transport and live school service are not part of this browser test.
- Source and rendered light Profile, Messages, Notifications and AI screenshots were opened together in one comparison input. Mobile and revised AI captures were subsequently inspected at readable size. Header/portrait/toggle details are legible in the full-width captures; separate crops were unnecessary.

## Findings and iterations

1. **P2, AI Study copy:** initial screenshot contained fixed “10 pages / 30,000 characters” limits beside configurable values. Replaced the fixed claim with a localized explanation of the dynamic limits in RU/KK/EN. Re-ran browser checks and inspected revised `reader.png`; only configured numbers remain. Resolved.
2. Screenshot capture adjustment: scroll to top before capturing Messages so a full-page screenshot does not depict fixed sidebar content at the prior composer scroll offset. This was a capture-state difference, not a runtime sidebar displacement.

## Required surfaces

- **Typography:** Times New Roman display headings, readable sans-serif body and controls; clear heading hierarchy and wrapping on narrow screens. No missing glyphs observed in the tested three locales. Native file-picker text follows the browser's locale, independently of app locale.
- **Spacing/layout:** avatar beside Profile title; compact sidebar toggle beside the logo. Panels stack on phones, AI expands above reading content. Rectangular controls with modest radii; no hover lift. No page overflow at 320/390 px. The grade table intentionally scrolls horizontally within its labelled, keyboard-focusable region.
- **Colors/tokens:** warm ivory/green light palette and forest/olive dark palette, with copper panel accents. Shared surfaces retain readable foregrounds. Notification success accents follow the site palette instead of neon green.
- **Images/assets:** original botanical artwork retained. PDF first-page rendering verified with a real, deliberately simple green-page test PDF; the green rectangle in `reader.png` is its actual content, not a production placeholder. Signed production textbook imagery still depends on access to the deployed catalog. Avatar initials are the intentional no-photo fallback.
- **Copy/content:** demo grades are explicitly labelled, failed import keeps prior data, name lookup instructions explain exact display names, cloud migration setup states are localized. Law and Art translations covered by tests. No decorative quotations added.

## Verified interactions

- Sidebar divider changes position, collapse/expand works, state survives reload.
- Light/dark selection; exactly two theme options.
- Exact-name conversation start and sending through real local database RPCs.
- Incoming notification, toast and mark-read action.
- CSV import, invalid-file error and preservation of previous grades.
- PDF first-page canvas and expanded AI panel.
- Responsive layouts at 320 and 390 px; diary in RU/KK/EN.
- Reduced-motion cursor suppression; no browser page errors.
- 14 focused unit/database tests passed. Production build, TypeScript and ESLint passed.

## Remaining environment limits

Remote Supabase migrations have not been applied: only a publishable key is available. No live SMS connector or authenticated school export was supplied; Diary is a local HTML/CSV demo adapter. Browser coverage is Chromium, not Safari/WebKit. These are deployment/coverage boundaries, not claims of verified remote functionality.

## Implementation checklist

- [x] Resolve AI limit-copy mismatch and inspect revised capture.
- [x] Inspect desktop themes, avatar placement and narrow layouts.
- [x] Exercise key UI and isolated database flows.
- [ ] Apply remote migrations following `docs/community-setup.md` before enabling cloud DMs.

final result: passed
