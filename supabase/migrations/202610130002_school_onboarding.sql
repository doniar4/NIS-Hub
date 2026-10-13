begin;
create table public.nis_cities(id text primary key,name_ru text not null,name_kk text not null,name_en text not null);
create table public.nis_schools(id text primary key,city_id text not null references public.nis_cities(id),name_ru text not null,name_kk text not null,name_en text not null,website text not null);
-- Source: https://schools.nis.edu.kz/ru, checked 2026-10-13. Includes the 21 NIS schools, not the separate international schools.
insert into public.nis_cities(id,name_ru,name_kk,name_en) values
('astana','Астана','Астана','Astana'),
('almaty','Алматы','Алматы','Almaty'),
('shymkent','Шымкент','Шымкент','Shymkent'),
('oral','Уральск','Орал','Oral'),
('aktobe','Актобе','Ақтөбе','Aktobe'),
('atyrau','Атырау','Атырау','Atyrau'),
('aktau','Актау','Ақтау','Aktau'),
('kostanay','Костанай','Қостанай','Kostanay'),
('petropavl','Петропавловск','Петропавл','Petropavl'),
('kokshetau','Кокшетау','Көкшетау','Kokshetau'),
('karaganda','Караганда','Қарағанды','Karaganda'),
('pavlodar','Павлодар','Павлодар','Pavlodar'),
('semey','Семей','Семей','Semey'),
('oskemen','Усть-Каменогорск','Өскемен','Oskemen'),
('taldykorgan','Талдыкорган','Талдықорған','Taldykorgan'),
('taraz','Тараз','Тараз','Taraz'),
('turkistan','Туркестан','Түркістан','Turkistan'),
('kyzylorda','Кызылорда','Қызылорда','Kyzylorda');
insert into public.nis_schools(id,city_id,name_ru,name_kk,name_en,website) values
('astana-nura','astana','НИШ Астана-Нура','НЗМ Астана-Нұра','NIS Astana-Nura','https://schools.nis.edu.kz/ru/school/nzm-astana-nura'),
('astana-ib','astana','НИШ Астана','НЗМ Астана','NIS Astana','https://schools.nis.edu.kz/ru/school/nzm-astana'),
('almaty-medeu','almaty','НИШ Алматы-Медеу','НЗМ Алматы-Медеу','NIS Almaty-Medeu','https://schools.nis.edu.kz/ru/school/nzm-almaty-medeu'),
('almaty-nauryzbay','almaty','НИШ Алматы-Наурызбай','НЗМ Алматы-Наурызбай','NIS Almaty-Nauryzbay','https://schools.nis.edu.kz/ru/school/nzm-almaty-nauryzbay'),
('shymkent-abai','shymkent','НИШ Шымкент-Абай','НЗМ Шымкент-Абай','NIS Shymkent-Abai','https://schools.nis.edu.kz/ru/school/nzm-symkent-abai'),
('shymkent-karatau','shymkent','НИШ Шымкент-Каратау','НЗМ Шымкент-Қаратау','NIS Shymkent-Karatau','https://schools.nis.edu.kz/ru/school/nzm-symkent-qaratau'),
('oral','oral','НИШ Уральск','НЗМ Орал','NIS Oral','https://schools.nis.edu.kz/ru/school/nzm-oral'),
('aktobe','aktobe','НИШ Актобе','НЗМ Ақтөбе','NIS Aktobe','https://schools.nis.edu.kz/ru/school/nzm-aqtobe'),
('atyrau','atyrau','НИШ Атырау','НЗМ Атырау','NIS Atyrau','https://schools.nis.edu.kz/ru/school/nzm-atyrau'),
('aktau','aktau','НИШ Актау','НЗМ Ақтау','NIS Aktau','https://schools.nis.edu.kz/ru/school/nzm-aqtau'),
('kostanay','kostanay','НИШ Костанай','НЗМ Қостанай','NIS Kostanay','https://schools.nis.edu.kz/ru/school/nzm-qostanai'),
('petropavl','petropavl','NIS Петропавловск','НЗМ Петропавл','NIS Petropavl','https://schools.nis.edu.kz/ru/school/nis-petropavl'),
('kokshetau','kokshetau','НИШ Кокшетау','НЗМ Көкшетау','NIS Kokshetau','https://schools.nis.edu.kz/ru/school/nzm-koksetau'),
('karaganda','karaganda','НИШ Караганда','НЗМ Қарағанды','NIS Karaganda','https://schools.nis.edu.kz/ru/school/nzm-qaragandy'),
('pavlodar','pavlodar','НИШ Павлодар','НЗМ Павлодар','NIS Pavlodar','https://schools.nis.edu.kz/ru/school/nzm-pavlodar'),
('semey','semey','НИШ Семей','НЗМ Семей','NIS Semey','https://schools.nis.edu.kz/ru/school/nzm-semei'),
('oskemen','oskemen','НИШ Усть-Каменогорск','НЗМ Өскемен','NIS Oskemen','https://schools.nis.edu.kz/ru/school/nzm-oskemen'),
('taldykorgan','taldykorgan','НИШ Талдыкорган','НЗМ Талдықорған','NIS Taldykorgan','https://schools.nis.edu.kz/ru/school/nzm-taldyqorgan'),
('taraz','taraz','НИШ Тараз','НЗМ Тараз','NIS Taraz','https://schools.nis.edu.kz/ru/school/nzm-taraz'),
('turkistan','turkistan','НИШ Туркестан','НЗМ Түркістан','NIS Turkistan','https://schools.nis.edu.kz/ru/school/nzm-turkistan'),
('kyzylorda','kyzylorda','НИШ Кызылорда','НЗМ Қызылорда','NIS Kyzylorda','https://schools.nis.edu.kz/ru/school/nzm-qyzylorda');
alter table public.nis_cities enable row level security;
alter table public.nis_schools enable row level security;
revoke all on public.nis_cities,public.nis_schools from public,anon,authenticated;
grant select on public.nis_cities,public.nis_schools to authenticated;
create policy nis_cities_read on public.nis_cities for select to authenticated using(true);
create policy nis_schools_read on public.nis_schools for select to authenticated using(true);
-- Existing class and timetable data belong to the original NIS Uralsk deployment.
alter table public.classes add column school_id text not null default 'oral' references public.nis_schools(id);
alter table public.profiles add column school_id text references public.nis_schools(id);
alter table public.profiles add column onboarding_completed_at timestamptz;
-- Preserve established profiles; new and unfinished accounts begin with the map.
update public.profiles p set school_id=c.school_id,onboarding_completed_at=now()
 from public.classes c where c.id=p.class_id and nullif(btrim(p.display_name),'') is not null;

create function public.check_profile_school_class() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.school_id is not null and new.class_id is not null and not exists(
   select 1 from public.classes c where c.id=new.class_id and c.school_id=new.school_id
 ) then raise exception 'class_school_mismatch' using errcode='23514'; end if;
 return new;
end $$;
create trigger profiles_school_class before insert or update of school_id,class_id on public.profiles
 for each row execute function public.check_profile_school_class();
revoke all on function public.check_profile_school_class() from public,anon,authenticated;

create function public.save_profile_school(p_city text,p_school text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from public.nis_schools where id=p_school and city_id=p_city) then
  raise exception 'invalid_school' using errcode='23514';
 end if;
 perform 1 from public.profiles where id=uid for update;
 if not found then raise exception 'profile_missing' using errcode='23503'; end if;
 update public.profiles set school_id=p_school,class_id=case
  when exists(select 1 from public.classes c where c.id=class_id and c.school_id=p_school) then class_id
  else null end where id=uid;
end $$;

create function public.complete_profile_onboarding() returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.profiles;
begin
 if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select * into p from public.profiles where id=uid for update;
 if not found or p.school_id is null or nullif(btrim(p.display_name),'') is null then
  raise exception 'incomplete_profile' using errcode='23514';
 end if;
 update public.profiles set onboarding_completed_at=coalesce(onboarding_completed_at,now()) where id=uid;
end $$;
revoke all on function public.save_profile_school(text,text),public.complete_profile_onboarding() from public,anon;
grant execute on function public.save_profile_school(text,text),public.complete_profile_onboarding() to authenticated;
notify pgrst,'reload schema';
commit;
