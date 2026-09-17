begin;

-- Correct commonly imported subject names that were not included in the
-- initial localisation migration. Values entered by an administrator are kept
-- unless they are blank or repeat a label from another language.
with names(ru, kz, en) as (values
  ('Основы права', 'Құқық негіздері', 'Fundamentals of Law'),
  ('Основы предпринимательства и бизнеса', 'Кәсіпкерлік және бизнес негіздері', 'Fundamentals of Entrepreneurship and Business'),
  ('Глобальные компетенции', 'Жаһандық құзыреттер', 'Global Competencies'),
  ('Естествознание', 'Жаратылыстану', 'Natural Science'),
  ('Познание мира', 'Дүниетану', 'Knowledge of the World'),
  ('Художественный труд', 'Көркем еңбек', 'Art and Craft'),
  ('Изобразительное искусство', 'Бейнелеу өнері', 'Visual Arts'),
  ('Начальная военная и технологическая подготовка', 'Алғашқы әскери және технологиялық дайындық', 'Basic Military and Technological Training'),
  ('Русский язык и литература', 'Орыс тілі мен әдебиеті', 'Russian Language and Literature'),
  ('Казахский язык и литература', 'Қазақ тілі мен әдебиеті', 'Kazakh Language and Literature')
)
update public.subjects as subject
set
  name_ru = names.ru,
  name_kz = case
    when nullif(btrim(subject.name_kz), '') is null or subject.name_kz in (names.ru, names.en) then names.kz
    else subject.name_kz
  end,
  name_en = case
    when nullif(btrim(subject.name_en), '') is null or subject.name_en in (names.ru, names.kz) then names.en
    else subject.name_en
  end
from names
where lower(btrim(subject.name)) in (lower(names.ru), lower(names.kz), lower(names.en));

commit;
