# NIS Hub Home Screen icons

Source: existing `src/app/icon.png` (500×500 PNG, blue sprout). This browser favicon is unchanged. No larger version of the same artwork exists in the repository; the 512px standard icon contains the original 500px pixels with a 6px background extension, not an upscale.

- iPhone/iPad: `src/app/apple-icon.png`, opaque 180×180 PNG. Next App Router generates its `apple-touch-icon` link automatically. Root Metadata API declares the NIS Hub title and standalone capability, including the legacy iOS capability directive. No new corner mask is applied: the source's original frame is retained and the OS controls the final icon shape.
- Android: `src/app/manifest.ts` generates `/manifest.webmanifest` and its single automatic manifest link. Name/short name: NIS Hub; root start URL/scope; standalone display. `/icons/icon-192.png`, `/icons/icon-512.png` and `/icons/icon-maskable-512.png` are opaque PNGs derived exclusively from the favicon. Maskable uses the same image with extra safe padding; the sprout stays within the central 80%-diameter circle.

Regenerate after reviewing a favicon change:

```sh
node scripts/prepare-home-screen-icons.mjs
node --import tsx --test tests/home-screen-icons.test.ts
npm run build
```

Generated PNGs should be included in the reviewed commit with the metadata. No provider credentials, database migration, service worker, offline mode or install-prompt UI is introduced.

## Real device verification after deployment

1. Open the HTTPS production root in Safari on iPhone/iPad. Share → Add to Home Screen. Check the blue sprout and `NIS Hub` name, add it, and launch the new icon. Where supported it should open without Safari's normal address bar. If offered, keep "Open as Web App" enabled.
2. Open the HTTPS production root in Chrome on Android. Menu → Install app / Add to Home screen (wording and installation availability depend on browser/device). Check name and icon, install/add, then launch. A supported installed web app uses standalone; some shortcut-only flows may still open a normal tab.
3. Remove and re-add an old Home Screen shortcut if it retained a cached icon. Refreshing the site's browser favicon alone does not necessarily update an installed shortcut.
4. Verify the manifest and every linked PNG return 200 without login. The file-based Apple URL is read from the actual `link[rel="apple-touch-icon"]` because Next can attach a cache-busting query. Confirm there is exactly one manifest link and one Apple icon link and that the normal favicon still references `/icon.png`.

Automated Chromium/WebKit checks validate metadata and built asset delivery; they do not simulate the OS launcher/install sheet. Final Home Screen appearance and standalone launch require physical devices. No deployment is performed automatically.

## Validation completed

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test` with the existing local Reader PDF: 198 passed, no failures or skips.
- `npm run build`: passed; `/apple-icon.png` and `/manifest.webmanifest` are static build routes.
- `node --import tsx --test tests/home-screen-icons.smoke.ts`: passed in Chromium (Pixel 7 emulation) and WebKit (iPhone 13 emulation), against the real production build. All linked images/manifest return 200 anonymously with correct MIME types/dimensions; one favicon, one Apple icon and one manifest link; both capability/title directives present.
- Original favicon Git blob remains `a1d3e2630e5fc71a245826229e47e9928d3d77d4` before and after; standard 512px icon retains its original flattened 500px pixels without interpolation.
- Physical installation and standalone launch are **not yet verified**. Existing installed shortcuts may need removal/re-addition after the reviewed change is deployed.

Reference: [Next.js file-based icons](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons), [MDN maskable safe area](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons), [Apple standalone and Web Clip configuration](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).
