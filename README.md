# NIS Hub — v0.5

For the current release, start with [v0.5 deployment setup](docs/v0.5-setup.md), [Telegram setup](docs/support-telegram-setup.md) and [implementation report](docs/v0.5-report.md). Apply the four additive v0.5 migrations before deploying this branch. Finalized Phase 4 data/private access are preserved.

Phase 4 setup and migration order: [docs/phase-4-setup.md](docs/phase-4-setup.md). Phase 4 replaces per-book approval runtime gates and date-by-date schedule management; earlier phase docs describe historical behavior.

Student learning hub built on the existing Next.js 16 application. Supabase Auth, PostgreSQL RLS and private Storage back accounts, profiles, published school-collection books, PDF reading, bookmarks and reading progress.

## Local development

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Configure public Supabase settings in `.env.local` using `.env.example`; never commit credentials or use a service-role key in the application. See [Supabase setup](docs/supabase-setup.md).

## Phase 3

- Persistent Light/Dark/System theme and RU/KZ/EN interface (Kazakh language code `kk`).
- Unique Top 4 selectors; existing server and database validation retained.
- Private canonical `<uid>/avatar.webp` overwrite, bounded image normalization and 60-second replacement cooldown.
- Instant local library filtering after a bounded paginated initial load: 200 metadata records per page, maximum 5000 with an explicit truncation notice. No filter-triggered navigation or queries.
- Current-stack Privacy/Terms drafts in all three languages.
- Research-led schedule boundary and admin-only, permission-confirmed JSON import. **No EduPage scraping or automatic synchronization.**

Existing books, auth, reader and admin foundations are retained. No analytics, advertising or payments are added. Book/user metadata are not auto-translated.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

To include the existing local Reader PDF runtime regression:

```bash
NIS_READER_TEST_PDF=/absolute/path/to/nis-hub-reader-test.pdf npm test
```

That PDF is not committed; without this environment variable the PDF fixture suite explicitly skips.

For Chromium/WebKit verification, install Playwright browsers once, build/start the app on a separate local port, then run:

```bash
npx playwright install chromium webkit
npm run build
npm run start -- --hostname 127.0.0.1 --port 3101
# In a second terminal:
npm run test:browser
```

Browser checks require OpenSSL for a disposable localhost TLS certificate: production language cookies remain Secure. The harness bundles real client components in memory with synthetic data, separately from the Next app; public-page checks use the real application. It does not bypass real auth or mutate cloud data. `NIS_BROWSER_BASE_URL` can select the local test server; `NIS_BROWSER_ARTIFACTS` selects the screenshot directory. Use the same `PLAYWRIGHT_BROWSERS_PATH` for browser installation and execution if overriding it.

## Release gates

Review [Phase 3 report](docs/phase-3-report.md), [schedule research and JSON format](docs/schedule-source-research.md), migrations and real-session verification. Fill operator/contact/hosting/retention details and obtain legal/content-rights review before public launch. The v0.5 PR targets `main`; it is not automatically merged.
