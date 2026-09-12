# Schedule source research — 12 September 2026

## Decision

Implement an adapter and administrator-controlled import of an authorised file. Do **not** ship an EduPage scraper, undocumented API client, background polling, credentials flow or browser-side source fetch.

The owner supplied [NIS Uralsk's timetable](https://nisuralsk.edupage.org/timetable/) and answered “Да есть” to the URL/permission question on 12 September 2026. This is recorded as an owner indication of permission, not a verified licence for automated extraction. Its scope, authorised school contact, allowed fields, redistribution audience and provider conditions remain undocumented.

One credential-free GET of that exact URL returned HTTP 200 and the school timetable page title. This verifies public availability of the **HTML landing page**, not the completeness of lesson data, anonymous access to every view, permission to reuse it, or a stable API. No hidden endpoints were inspected, no accounts were used and no real timetable was imported.

## Official access and exports

- [EduPage public-view rights](https://help.edupage.org/?lang_id=1&p=u3%2Fu338%2Ft904): schools control what anonymous visitors can see; teacher/student views can have different access. A public class timetable must not be used to infer permission for other data.
- [Official online Excel/HTML export](https://www.help.edupage.org/?lang_id=1&p=lang_id%3D1&p=u3%2Fu64%2Ft985): an authorised school administrator selects a stored timetable and exports it through the administration interface. Prefer a school-provided export; this app must not take that administrator's credentials.
- [Official XML export](https://www.help.edupage.org/?lang_id=1&p=lang_id%3D1&p=u3%2Fu64%2Ft699): aSc Timetables supports default and configured XML exports. A school can choose a documented export configuration. Availability/licensing for this school's installation has not been established.
- [Identifier documentation](https://www.help.edupage.org/?lang_id=1&p=lang_id%3D1&p=u3%2Fu64%2Ft1052): temporary export IDs are not persistent across exports; configured `idprefix` can preserve system IDs. Do not match permanent NIS Hub rows using temporary IDs or guessed names.
- [Publication validity](https://www.help.edupage.org/?lang_id=1&p=lang_id%3D1&p=u3%2Fu338%2Ft886): timetables can have validity periods and alternate schedules. A weekly template cannot safely be treated as a dated daily schedule without resolving term/week/holiday/substitution rules.
- [EduPage privacy information](https://www.edupage.org/privacy/) describes school-initiated exports and school control of access. It is not a general scraping licence. The “Terms of service” link followed from this page resolved to [a training page](https://www.edupage.org/text4/), not a usable automation contract.

No documented general-purpose, anonymous timetable API or automation permission for this school was established in the official sources reviewed. This is a research limit, **not** a claim that no authorised integration exists. Ask the school and aSc support about a supported API/export agreement before adding a network adapter.

## Data boundary and manual path

`src/lib/schedule-source.ts` defines `ScheduleSource` and `ManualScheduleSource`; `src/lib/schedule.ts` reads the same normalized model from Supabase for the UI.

The Phase 3 import accepts a versioned JSON file, not arbitrary EduPage XML/HTML/XLS. An authorised administrator must review and map a school export into this format. No automated conversion is claimed.

```json
{
  "version": 1,
  "lessons": [{
    "class_id": "00000000-0000-4000-8000-000000000010",
    "date": "2026-09-14",
    "lesson_number": 1,
    "subject_id": "00000000-0000-4000-8000-000000000020",
    "teacher": null,
    "room": null
  }]
}
```

The IDs above are synthetic examples, not live school IDs. Obtain real class/subject UUIDs from the administrator reference list. Never import real students, email addresses, account credentials, attendance or grades. Teacher names and rooms are optional and should be omitted unless needed and explicitly permitted.

Limits: UTF-8 JSON ≤256 KiB, 1–500 lessons, real ISO dates, lesson numbers 1–20, existing class/subject UUIDs, teacher ≤100 characters, room ≤40. Unknown fields and duplicate class/date/lesson keys are rejected. The current internal model has one subject per class/date/lesson slot; split groups, multiweek cycles and substitutions require explicit school-approved resolution, not silent flattening.

The UI previews the normalized rows and asks the administrator to confirm permission. Server validation repeats all checks. An admin-only, SECURITY INVOKER RPC performs atomic idempotent upserts on `(class_id,date,lesson_number)`; foreign keys/RLS remain active. Invalid imports roll back; omissions do **not** delete existing lessons. Existing manual single-record editing remains available.

## Refresh, caching and remaining gates

No automated refresh runs in Phase 3. The stored schedule remains the last administrator-approved import/edit and may become stale. The school must define who supplies revisions, term validity and how urgent substitutions are confirmed.

Before a future network adapter: obtain documented permission/terms and audience; agree stable ID mapping and allowed fields; obtain a sanitized real export fixture; resolve dates/timezone (Asia/Oral), groups and substitutions; specify refresh SLA. Proposed starting safeguards, only after approval: server-only fetching, ≥1 hour cache, on-demand administrator refresh, 10-second timeout, bounded payload, conditional requests if supported, no retries against auth/anti-bot blocks, schema-change detection and atomic upsert without deletion. These are proposals, not a current school agreement.

No implementation of scraping is justified by the evidence gathered. School-provided authorised export/manual JSON is the Phase 3 integration boundary.
