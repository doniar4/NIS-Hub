begin;
update public.subjects set name_ru='Основы права',name_kz='Құқық негіздері',name_en='Fundamentals of Law'
 where lower(btrim(name)) in ('основы права','құқық негіздері','fundamentals of law','law');
update public.subjects set name_ru='Искусство',name_kz='Өнер',name_en='Art'
 where lower(btrim(name)) in ('искусство','өнер','art','arts');
commit;
