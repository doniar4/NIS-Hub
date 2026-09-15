begin;
-- Preserve the legacy unique name and IDs used by imports; add an explicit RU field.
alter table public.subjects add column name_ru text check(length(name_ru) between 1 and 100);
update public.subjects set name_ru=name;
-- Only known exact catalog aliases are translated. Unknown labels need owner review.
with names(ru,kz,en) as(values
 ('Математика','Математика','Mathematics'),('Алгебра','Алгебра','Algebra'),('Геометрия','Геометрия','Geometry'),
 ('Физика','Физика','Physics'),('Химия','Химия','Chemistry'),('Биология','Биология','Biology'),
 ('География','География','Geography'),('Информатика','Информатика','Computer Science'),
 ('История Казахстана','Қазақстан тарихы','History of Kazakhstan'),('Всемирная история','Дүниежүзі тарихы','World History'),
 ('Русский язык','Орыс тілі','Russian Language'),('Русская литература','Орыс әдебиеті','Russian Literature'),
 ('Казахский язык','Қазақ тілі','Kazakh Language'),('Казахская литература','Қазақ әдебиеті','Kazakh Literature'),
 ('Английский язык','Ағылшын тілі','English Language'),('Физическая культура','Дене шынықтыру','Physical Education'))
update public.subjects s set name_ru=n.ru,
 name_kz=case when nullif(btrim(s.name_kz),'') is null or s.name_kz in(n.ru,n.en) then n.kz else s.name_kz end,
 name_en=case when nullif(btrim(s.name_en),'') is null or s.name_en in(n.ru,n.kz) then n.en else s.name_en end
from names n where lower(btrim(s.name)) in(lower(n.ru),lower(n.kz),lower(n.en));
comment on column public.subjects.name_ru is 'Russian UI label. Legacy name retained for identity/import compatibility. Review unknown labels before launch.';
commit;
