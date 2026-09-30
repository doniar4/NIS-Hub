# Storage Egress audit — BookCover hotfix

Base: `b99bc9afbce5bb8862dff29ad9ff0178500a8bbf` (v1.2 SMS challenge test fix). No schema, RLS, bucket visibility, authentication, or PDF access TTL changes.

## Flow

| Before | After |
| --- | --- |
| A surface mounting BookCover → `/api/books/<id>/access` → signed `book-files` PDF → PDF.js page 1 → Storage egress | A surface mounting BookCover → small signed `book-covers` image, or placeholder |
| Reader → signed PDF | Reader → signed PDF when the user opens the book |
| Explicit extraction → full PDF download when needed | Explicit extraction → full PDF download only when `begin_book_extraction` reports `ready: false` |

The **current LibraryBrowser in this base commit does not mount BookCover**; it shows catalog metadata and subject motifs. This means the exact `/library` route already has no BookCover PDF request in this revision. The hotfix removes the high-egress BookCover path from its actual use in ReadingList (Home/Profile), and prevents any future catalog use from fetching PDF bytes.

## Classified call sites

| Code | Egress classification |
| --- | --- |
| `src/components/book-cover.tsx` | **HIGH before → LOW after.** PDF.js and access API removed. Signed private image from `book-covers` is fetched only when URL exists; failed/missing images show localized placeholder. |
| `src/lib/queries.ts` | Small private image egress only. `getReading()` signs canonical cover paths in `book-covers` for 3600 seconds. Signing is not a PDF download. |
| `src/components/pdf-reader.tsx` | Expected PDF egress when Reader is opened: calls the access route, then PDF.js reads the signed PDF. Reader remains unchanged. |
| `src/components/extract-book-text.tsx` | Expected conditional full PDF download after explicit extraction. `if (job.ready) return` runs before `storage.from("book-files").download(job.path)`. |
| `src/app/api/books/[id]/access/route.ts` | Expected Reader signing from private `book-files`, with publication/auth checks. PDF URL TTL remains **60 seconds**. |
| `src/components/book-editor.tsx` | Admin upload to `book-files`, not a browsing download. |
| `src/app/actions/books.ts` | Admin file `info(path)` metadata check, not PDF download. |
| `src/components/site-shell.tsx`, `src/app/profile/page.tsx` | Avatar signed URLs from `avatars`, unrelated to PDFs. |
| `tests/**` | Fixture PDF and RLS tests verify Reader/security; not production browsing. |

Search terms audited across source: `book-files`, `.download(`, `createSignedUrl`, `createSignedUrls`, `pdfjs.getDocument`, `/api/books/`. Their legitimate Reader, extraction, upload, and avatar uses were left intact.

## Verification boundary

Verified with `NIS_READER_TEST_PDF` set to the existing three-page test PDF: `npm test` — 126 passed, 0 skipped, 0 failed (including real Reader PDF checks); `npm run typecheck` — passed; `npm run lint` — 0 errors, 8 warnings in untouched files; `npm run build` — passed. The focused browser smoke verifies a signed-image request, failed/null placeholders, no PDF/access request, and no page error. The component test verifies absence of PDF code/dependencies. The access-route and PDF unit tests passed in `npm test`.

The older community/Phase 4 browser smoke harnesses currently fail during esbuild bundling of Next.js server imports (for example `node:stream`), before browser assertions. A live authenticated Library/Reader network check needs a safe test session and a published book with a real cover; the isolated browser fixture proves component behavior, not live Supabase egress metrics.
