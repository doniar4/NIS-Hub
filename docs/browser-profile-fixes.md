# Registration, profile and browser fixes — 13 October 2026

## Changes

- Preserve uncontrolled form drafts after an action returns an error. React's automatic reset previously emptied email/password/consent and prevented a retry. Block duplicate submissions and show a timestamp-based retry countdown on Auth rate-limit responses. Trim email addresses; preserve passwords exactly.
- Distinguish the confirmation email sending limit from other request limits. Provider protections remain authoritative. A project-wide email limit requires configuring custom SMTP and the project's Auth rate limits; a frontend patch cannot change that configuration. No live Auth settings, accounts or database migrations were modified.
- Serialize profile saves and save edits made while an earlier request is pending. Verify the saved name, class, bio and ordered subjects before reporting success. Revalidate the root layout so profile-dependent headers and pages receive the update.
- Revalidate the layout after avatar writes and reset portrait image error state when its signed URL changes.
- Add an avatar editor with preview, zoom, pointer dragging, arrow keys, position sliders, reset and cancel. Accept browser-decodable images up to 20 MiB and 40 million pixels, including JPG/JPEG/PNG/WebP/GIF/AVIF. The editor exports a 512px JPEG; the existing server validates it, strips metadata and stores a 256px WebP. Unsupported formats fail with a localized message. Storage privacy and the 60-second replacement interval are retained.
- Keep the search button's type stable. Empty activation expands the field and focuses it synchronously after committing its visibility, including iOS keyboard activation. A nonempty query submits the library search.
- Localize favourite-subject controls and the study assistant in Russian/Kazakh, including dialog titles and accessibility labels.
- Use native touch scrolling on phones/tablets; keep desktop wheel inertia. Let forms, sidebars, messages, PDF panes and dialogs scroll independently. Stop desktop inertia for modal dialogs and hidden tabs. Add mobile scroll offsets and 16px form controls to avoid sticky-header overlap and iOS input zoom. Move constant WebGL uniforms out of the frame loop and make parallax damping independent of refresh rate.

## Verification

Use Node 22 or 24 as declared in package.json. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, then `npm run test:browser:compatibility` after installing Playwright browsers.

Confirmed checks: all 70 unit/database test files passed, as did lint, TypeScript and the production build. The complete 24-configuration browser matrix passed in Chromium, Firefox, WebKit and official Google Chrome. After localizing the photo picker, all six WebKit configurations passed again. Existing mobile messages, real PDF reader (synthetic three-page test PDF) and schedule scrolling checks passed; slow-network auth and profile-persistence checks also passed. The schedule regression now tests the actual dock glass surface introduced by the preceding navigation change, rather than its transparent positioning wrapper.

The compatibility harness uses real production components and server-side avatar normalization with isolated actions. It covers slow profile saves, edits during saving, reload persistence, locale changes, malformed image recovery, crop pixel output, common image formats, required consent, rate-limit retry with preserved fields, empty/populated search, mobile drawer focus/cleanup and horizontal overflow. It runs light/dark at 320px, 390px and 1280px in Chromium, Firefox and WebKit. Optional `NIS_BROWSER_ENGINES=chrome` with `NIS_CHROME_EXECUTABLE` runs the same suite in installed Google Chrome. `NIS_WEBKIT_EXECUTABLE` supports a local WebKit executable override.

Existing auth-network and profile-persistence checks cover slow Wi-Fi, failed decorative chunks, theme/locale changes and recovery after a failed save. Mobile schedule/reader/messages checks use synthetic fixtures only.

Playwright WebKit and touch viewport emulation do not verify physical iPhones, Safari browser chrome, OS photo-picker conversions or authenticated production Supabase operations. Live registration delivery and avatar/profile persistence still need a connected project and real-device checks after deployment. Supabase integration was offered for the Auth configuration; it was not connected during this work.
