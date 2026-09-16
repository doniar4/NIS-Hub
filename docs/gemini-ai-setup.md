# Gemini AI Study setup and troubleshooting

AI Study is optional and server-side. It is not a whole-library chatbot. Enable only after the operator has enforced the confirmed adult (18+) audience and reviewed Google's current terms and the right to send selected textbook text to the provider. The app does not verify age.

## Environment

Configure these on the Next.js server (local `.env.local` or deployment secret settings):

```dotenv
AI_STUDY_ENABLED=true
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
AI_STUDY_DAILY_LIMIT=10
AI_STUDY_MAX_PAGES=10
AI_STUDY_MAX_SOURCE_CHARS=30000
AI_STUDY_TIMEOUT_MS=25000
```

Supply your own key privately. Never use `NEXT_PUBLIC_GEMINI_API_KEY` or commit `.env.local`. Restart the running Next.js process after environment changes; update the hosting environment separately. Do not change Supabase keys, Storage visibility or RLS to repair a provider error.

On 2026-09-16 the configured account returned HTTP 404 for `gemini-2.5-flash`, explaining that it is no longer available to new users and recommending `gemini-3.6-flash`. The latter accepted a bounded synthetic study request with the compatible schema. A model can appear in `models.list` yet reject generation for the account; verify with a small non-private generation. No automatic model fallback is used.

Limits may be lowered through the environment, not raised above 10 attempts per user/day, 10 pages, 30,000 source characters or 60,000 ms. The daily counter resets on the Asia/Oral calendar day, not a rolling 24-hour window. Reserved attempts count even on provider failure; cache hits do not consume another attempt. Do not clear quota tables to work around an error.

## Text preparation

An existing admin publishes the edition and runs **Extract text for AI** in its book editor. Extraction uses the private PDF and saves bounded per-page text through admin-checked RPCs. A successful current extraction is reused; scans without text have no OCR fallback. PDF replacement invalidates the extraction revision and old cache. The Reader itself does not depend on Gemini being enabled.

This error fix adds **no migration**. AI Study relies on the existing v0.5.1 migrations, in order:

1. `202609150001_v051_book_grades.sql`
2. `202609150002_v051_book_variants.sql`
3. `202609150003_v051_subject_localization.sql`
4. `202609150004_v051_book_pages.sql`
5. `202609150005_v051_ai_study.sql`

Do not reapply migrations already recorded by your Supabase project.

## Safe diagnostics

In development only, the server prints a closed diagnostic such as:

```text
[AI Study] { stage: 'provider-error', code: 'configuration', providerStage: 'http', httpStatus: 404 }
```

Raw provider/database messages, textbook text, user/book IDs, keys and signed URLs are not logged. Production returns localized coarse errors and does not print these diagnostics.

- `configuration / http / 404`: check model availability for the configured key.
- HTTP 400: check request/schema compatibility. The provider receives a small structural schema; exact bounds and citations are still strictly checked locally.
- HTTP 401/403: check key validity, API/project restrictions and regional availability privately.
- `provider_quota`: Gemini quota, distinct from the app's daily limit.
- `timeout`: try a smaller source range. No automatic retry sends another paid request.
- `busy`: an identical request is already reserved.
- `failed / validate-response`: an answer failed shape, length or source citation checks; it is not shown or cached as a successful answer.
- `unavailable`: check publication, current extraction, selected range and source size.

## Privacy and manual verification

Only selected page text, mode instructions and response locale are sent to Gemini, not profiles, emails, tokens, private URLs or the whole PDF. Review free-versus-paid data handling before launch. Own-user cache records and quota records stay in Supabase; define retention with the operator.

With your real session: reload the Reader, generate a summary for pages 7–9, verify the displayed source range and quotes, then repeat to verify a cache hit. Try Review/SOR/SOCH/self-check and RU/KZ/EN. Confirm provider failure leaves PDF navigation, bookmarks and progress working.

Official references: [models](https://ai.google.dev/gemini-api/docs/models), [GenerateContent API](https://ai.google.dev/api/generate-content), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [terms](https://ai.google.dev/gemini-api/terms).
