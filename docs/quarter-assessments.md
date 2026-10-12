# Quarter assessments (СОЧ / ТЖБ)

Apply `supabase/migrations/202610120001_quarter_assessments.sql` once to the
connected Supabase project, followed by `supabase/migrations/202610120002_assessment_periods.sql`, before using the import. The application keeps the
ordinary timetable available when this table has not yet been installed.

Open **Admin → Schedule → Import** (`/admin/schedule/import`). Upload an `.xlsx`,
preview the school year, quarter (1–4), classes, dates and lesson ranges, then apply it. The example download
is a fully fictional 2054–2055 first-quarter workbook. Replace its example dates
and subjects before importing. No uploaded school workbook is distributed publicly.

The workbook has a class or grade in the first column, lesson ranges such as
`3-4 уроки` in the second, and dates such as `14 октября (среда)` in the remaining
column headers. Repeated headers, merged class cells and line breaks are supported.
Numeric grades expand to every matching class in the catalog. Individual class
names target that class. Russian, Kazakh and English month names, numeric dates
and Excel date cells are supported. With an academic year in the title, autumn
dates use the first year and January–August use the second. School year and quarter
are detected from the title; select them in the form when absent. Dates carrying
their own year retain it. A conflicting school year is rejected before publishing.

Assessments occupy the whole lesson range specified in the file. A label such as
`(40 мин)` describes assessment duration; it does not invent a different start
time or a classroom. Clock times come from matching ordinary timetable slots
when available. Multi-subject elective labels are preserved as written; material
links appear only when a single catalog subject can be identified.

The dated assessments overlay the listed slots on the home dashboard and the
schedule browser. Other slots and dates retain the ordinary timetable. Both
EduPage synchronization and normal CSV imports remain independent of the
assessment table. Re-uploading a corrected workbook atomically replaces the
assessments for its school year, quarter and uploaded classes, including removing
cleared cells and old dates when an exam moves. Other quarters, school years and
classes are preserved. A preview records the current revision: concurrent changes
require another preview before saving. Administrators can select uploaded
dates and remove their assessments to return to the ordinary timetable.

Local regression tests use a synthetic workbook, PostgreSQL-compatible PGlite,
and a browser regression with the real global Lenis smooth-scroll component:

```bash
node --import tsx --test tests/assessment-schedule.test.ts tests/assessment-database.test.ts
node --import tsx --test tests/pdf-thumbnails-scroll-browser.smoke.ts
```

These checks do not apply the migration or publish a timetable to a live project.
