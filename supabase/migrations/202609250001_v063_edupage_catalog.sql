-- v0.6.3: canonical catalog entries and EduPage names from the reviewed preview.
-- This migration intentionally adds no grade-specific subject duplicates.
begin;

with requested(name,name_ru,name_kz,name_en,short_name) as (values
  ('ГППР','ГППР','ГППР','GPPR','ГППР'),
  ('Программирование','Программирование','Бағдарламалау','Programming','Программирование'),
  ('НВП','НВП','АӘД','Basic military training','НВП'),
  ('Инженерлік қызметінің негізі','Основы инженерной деятельности','Инженерлік қызметінің негізі','Fundamentals of Engineering','Инженерлік қызметінің негізі'),
  ('Копирайтинг (каз.яз)','Копирайтинг (каз. яз.)','Копирайтинг (қаз. тілі)','Copywriting (Kazakh)','Копирайтинг (каз.яз)'),
  ('Копирайтинг (рус.яз)','Копирайтинг (рус. яз.)','Копирайтинг (орыс тілі)','Copywriting (Russian)','Копирайтинг (рус.яз)'),
  ('IELTS','IELTS','IELTS','IELTS','IELTS'),
  ('СДЖ ж Ө матем-қ тәсілдері','СДЖ ж Ө матем-қ тәсілдері','СДЖ ж Ө матем-қ тәсілдері','Mathematical methods','СДЖ ж Ө матем-қ тәсілдері'),
  ('Workout','Workout','Workout','Workout','Workout'),
  ('хореография','Хореография','Хореография','Choreography','Хореография'),
  ('Домбыра','Домбыра','Домбыра','Dombra','Домбыра'),
  ('Шахмат','Шахматы','Шахмат','Chess','Шахмат'),
  ('Тоғызқұмалақ','Тоғызқұмалақ','Тоғызқұмалақ','Togyzqumalaq','Тоғызқұмалақ'),
  ('Қыш құмыра','Гончарное дело','Қыш құмыра','Pottery','Қыш құмыра'),
  ('ГиП','ГиП','ГиП','GIP','ГиП'),
  ('Экономика','Экономика','Экономика','Economics','Экономика')
)
insert into public.subjects(name,name_ru,name_kz,name_en,short_name)
select r.name,r.name_ru,r.name_kz,r.name_en,r.short_name from requested r
where not exists (
  select 1 from public.subjects s where lower(btrim(r.name)) in (
    lower(btrim(s.name)),lower(btrim(coalesce(s.name_ru,''))),lower(btrim(coalesce(s.name_kz,''))),lower(btrim(coalesce(s.name_en,'')))
  )
)
on conflict(name) do nothing;

insert into public.classes(name,grade,section)
select '10K',10,'K'
where not exists (
  select 1 from public.classes where lower(regexp_replace(name,'\\s','','g'))='10k'
)
on conflict(name) do nothing;

with target_names(key,name) as (values
  ('gpp','ГППР'),('programming','Программирование'),('nvp','НВП'),('engineering','Инженерлік қызметінің негізі'),
  ('copy_kz','Копирайтинг (каз.яз)'),('copy_ru','Копирайтинг (рус.яз)'),('ielts','IELTS'),('math_methods','СДЖ ж Ө матем-қ тәсілдері'),
  ('workout','Workout'),('choreography','хореография'),('dombra','Домбыра'),('chess','Шахмат'),('togyzqumalaq','Тоғызқұмалақ'),('pottery','Қыш құмыра'),
  ('kazakh_literature','Казахский язык и литература'),('kazakh_literature','Қазақ тілі мен әдебиеті'),
  ('russian_literature','Русский язык и литература'),('mathematics','Математика'),('physics','Физика'),('biology','Биология'),
  ('informatics','Информатика'),('chemistry','Химия'),('geography','География'),('economics','Экономика'),('gip','ГиП')
), targets as (
  select distinct on (t.key) t.key,s.id from target_names t join public.subjects s on lower(btrim(t.name)) in (
    lower(btrim(s.name)),lower(btrim(coalesce(s.name_ru,''))),lower(btrim(coalesce(s.name_kz,''))),lower(btrim(coalesce(s.name_en,'')))
  ) order by t.key,s.created_at,s.id
), subject_aliases(alias,target) as (values
  ('ГППР','gpp'),('Программирование','programming'),('НВП','nvp'),('Инженерлік қызметінің негізі','engineering'),
  ('Копирайтинг (каз.яз)','copy_kz'),('Копирайтинг (рус.яз)','copy_ru'),
  ('IELTS І гр','ielts'),('IELTS II гр','ielts'),('IELTS III гр','ielts'),
  ('СДЖ ж Ө матем-қ тәсілдері','math_methods'),('Workout','workout'),('хореография','choreography'),('Домбыра','dombra'),
  ('Шахмат','chess'),('Тоғызқұмалақ','togyzqumalaq'),('Қыш құмыра','pottery'),
  ('Казахский язык и литература','kazakh_literature'),('Қазақ тілі мен әдебиеті','kazakh_literature'),
  ('Русский язык и литература','russian_literature'),
  ('Математика 7ч','mathematics'),('М10ч','mathematics'),('М10','mathematics'),('Математика 10сағ.-11кл','mathematics'),
  ('Физика 11 кл.','physics'),('Физика 11кл.','physics'),('Физика - 11кл.','physics'),('Физика 12кл.','physics'),('Физика-12кл.','physics'),('Физика - 12 кл.','physics'),
  ('Биология 11 кл.','biology'),('Биология - 11 кл.','biology'),('Биология-12кл.','biology'),
  ('Информатика 11кл.','informatics'),('Информатика-11кл.','informatics'),('Информатика - 11кл.','informatics'),('Информатика-11 кл.','informatics'),('Информатика 12кл.','informatics'),
  ('Химия-11кл.','chemistry'),('Химия-12кл.','chemistry'),('Химия - 12кл.','chemistry'),
  ('География 11кл.','geography'),('География 12','geography'),('География - 12','geography'),
  ('Экономика 11кл.','economics'),('Экономика 12кл.','economics'),
  ('ГиП-11 кл.','gip'),('ГиП 12 кл.','gip'),('ГиП-12кл.','gip'),('ГиП-12 кл.','gip')
), subject_patch as (
  select coalesce(jsonb_object_agg(lower(regexp_replace(btrim(a.alias),'\\s+',' ','g')),t.id),'{}'::jsonb) value
  from subject_aliases a join targets t on t.key=a.target
), class_patch as (
  select coalesce(jsonb_object_agg('10k',id),'{}'::jsonb) value from (
    select id from public.classes where lower(regexp_replace(name,'\\s','','g'))='10k' order by created_at,id limit 1
  ) class_target
)
insert into public.edupage_sync_state(id,aliases)
select true,jsonb_build_object('classes',class_patch.value,'subjects',subject_patch.value) from class_patch cross join subject_patch
on conflict(id) do update set aliases=jsonb_build_object(
  'classes',coalesce(public.edupage_sync_state.aliases->'classes','{}'::jsonb)||excluded.aliases->'classes',
  'subjects',coalesce(public.edupage_sync_state.aliases->'subjects','{}'::jsonb)||excluded.aliases->'subjects'
);

commit;
