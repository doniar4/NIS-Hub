-- Additive: retain class_id for historical compatibility; never guess a missing grade.
begin;
alter table public.books add column grade smallint check (grade between 1 and 12);
update public.books b set grade=case when c.grade between 1 and 12 then c.grade
  when substring(btrim(c.name) from '^([0-9]{1,2})(?![0-9])')::int between 1 and 12
  then substring(btrim(c.name) from '^([0-9]{1,2})(?![0-9])')::smallint end
from public.classes c where b.class_id=c.id;
comment on column public.books.class_id is 'Historical class-letter targeting. v0.5.1 uses books.grade.';
comment on column public.books.grade is 'Shared grade target. NULL legacy values require admin review; do not infer from book titles.';
create index books_grade_subject_idx on public.books(publication_status,grade,subject_id);
commit;
