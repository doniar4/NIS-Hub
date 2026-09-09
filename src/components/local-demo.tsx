"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { BookmarkIcon, CheckIcon } from "@/components/icons";
import { classOptions, readerPages, subjects } from "@/lib/data";

const profileStorageKey = "nis-library-demo-profile";

type DemoProfile = {
  displayName: string;
  classId: string;
  topSubjects: string[];
};

const initialProfile: DemoProfile = {
  displayName: "",
  classId: "10f",
  topSubjects: ["physics", "mathematics", "informatics", "history"],
};

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredClass() {
  if (typeof window === "undefined") return "10f";
  const saved = window.localStorage.getItem("nis-library-class");
  return saved && classOptions.some((item) => item.id === saved) ? saved : "10f";
}

export function ClassPicker() {
  const [classId, setClassId] = useState("10f");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setClassId(readStoredClass()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function updateClass(event: ChangeEvent<HTMLSelectElement>) {
    setClassId(event.target.value);
    window.localStorage.setItem("nis-library-class", event.target.value);
  }

  return <label className="block max-w-xs"><span className="field-label">Демонстрационный класс</span><select className="field" onChange={updateClass} value={classId}>{classOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

export function ReaderDemo() {
  const [page, setPage] = useState(0);
  const [savedPages, setSavedPages] = useState<number[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSavedPages(readStoredValue<number[]>("nis-library-demo-bookmarks", [])));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleBookmark() {
    const current = page + 1;
    const updated = savedPages.includes(current) ? savedPages.filter((saved) => saved !== current) : [...savedPages, current];
    setSavedPages(updated);
    window.localStorage.setItem("nis-library-demo-bookmarks", JSON.stringify(updated));
  }

  const isBookmarked = savedPages.includes(page + 1);

  return <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
    <section aria-label="Тестовый документ" className="reader-paper"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Технический документ · {page + 1} / {readerPages.length}</p><h2 className="mt-10 text-2xl font-semibold tracking-[-0.03em]">{readerPages[page].title}</h2><p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">{readerPages[page].body}</p></section>
    <aside className="border border-[var(--line)] bg-white p-5"><p className="field-label">Навигация</p><div className="mt-4 flex gap-2"><button className="button button-secondary flex-1" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Назад</button><button className="button button-secondary flex-1" disabled={page === readerPages.length - 1} onClick={() => setPage((current) => current + 1)}>Далее</button></div><button aria-pressed={isBookmarked} className="button mt-3 w-full justify-center" onClick={toggleBookmark}><BookmarkIcon size={17} />{isBookmarked ? "Закладка сохранена" : "Добавить закладку"}</button><p className="mt-5 text-sm leading-6 text-[var(--muted)]">Закладки сохраняются только в этом браузере. В продакшене они будут привязаны к профилю.</p></aside>
  </div>;
}

export function ProfileEditor() {
  const [profile, setProfile] = useState<DemoProfile>(initialProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setProfile(readStoredValue<DemoProfile>(profileStorageKey, initialProfile)));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function updateSubject(index: number, value: string) {
    const next = [...profile.topSubjects];
    next[index] = value;
    setProfile({ ...profile, topSubjects: next });
    setSaved(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (new Set(profile.topSubjects).size !== profile.topSubjects.length) return;
    window.localStorage.setItem(profileStorageKey, JSON.stringify(profile));
    setSaved(true);
  }

  const duplicates = new Set(profile.topSubjects).size !== profile.topSubjects.length;

  return <form className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]" onSubmit={submit}>
    <aside className="border border-[var(--line)] bg-white p-6"><div aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--ink)] text-2xl font-semibold text-white">{profile.displayName ? profile.displayName.slice(0, 1).toUpperCase() : "N"}</div><p className="mt-5 text-sm leading-6 text-[var(--muted)]">Аватары потребуют защищённого Storage. Пока в прототипе не загружаются персональные файлы.</p></aside>
    <div className="space-y-6"><div className="grid gap-5 sm:grid-cols-2"><label><span className="field-label">Отображаемое имя</span><input className="field" maxLength={60} onChange={(event) => { setProfile({ ...profile, displayName: event.target.value }); setSaved(false); }} placeholder="Ваше имя" value={profile.displayName} /></label><label><span className="field-label">Класс</span><select className="field" onChange={(event) => { setProfile({ ...profile, classId: event.target.value }); setSaved(false); }} value={profile.classId}>{classOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><fieldset><legend className="field-label">Top 4 subjects</legend><p className="mb-4 text-sm text-[var(--muted)]">Выберите четыре разных предмета. Порядок важен.</p><div className="grid gap-3 sm:grid-cols-2">{profile.topSubjects.map((subjectId, index) => <label className="top-select" key={`${index}-${subjectId}`}><span>{index + 1}</span><select aria-label={`Предмет ${index + 1}`} onChange={(event) => updateSubject(index, event.target.value)} value={subjectId}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>)}</div>{duplicates ? <p className="mt-3 text-sm font-medium text-[var(--danger)]">Каждый предмет можно выбрать только один раз.</p> : null}</fieldset><div className="flex flex-wrap items-center gap-4"><button className="button" disabled={duplicates} type="submit">Сохранить в этом браузере</button>{saved ? <p className="inline-flex items-center gap-2 text-sm text-[var(--success)]"><CheckIcon size={17} />Черновик сохранён локально</p> : null}</div><p className="text-sm leading-6 text-[var(--muted)]">Это не учётная запись и не отправляет данные на сервер. Подключение Supabase преобразует эту форму в защищённый профиль.</p></div>
  </form>;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [submitted, setSubmitted] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSubmitted(true); }
  const signup = mode === "signup";
  return <form className="mt-8 max-w-md space-y-5 border border-[var(--line)] bg-white p-6 sm:p-8" onSubmit={submit}><label><span className="field-label">Email</span><input autoComplete="email" className="field" required type="email" /></label><label><span className="field-label">Пароль</span><input autoComplete={signup ? "new-password" : "current-password"} className="field" minLength={8} required type="password" /></label>{signup ? <label className="flex items-start gap-3 text-sm leading-5 text-[var(--muted)]"><input className="mt-1 h-4 w-4" required type="checkbox" />Я ознакомился с черновиками Privacy Policy и Terms.</label> : null}<button className="button w-full justify-center" type="submit">{signup ? "Создать аккаунт" : "Войти"}</button>{submitted ? <p className="notice">Supabase ещё не подключён: форма не отправила данные и не создала учётную запись. Добавьте переменные окружения и Auth-настройку перед запуском для пользователей.</p> : null}</form>;
}

export function AdminSetup() {
  return <div className="mt-8 max-w-2xl border border-[var(--line)] bg-white p-6 sm:p-8"><h2 className="text-xl font-semibold tracking-[-0.02em]">Доступ администратора не настроен</h2><p className="mt-3 leading-7 text-[var(--muted)]">Маршрут намеренно не показывает форму управления книгами без подтверждённой роли. Перед запуском нужно подключить Supabase Auth, создать таблицы, включить RLS и назначить администратора вне браузера.</p><ol className="mt-6 list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]"><li>Создать проект Supabase и добавить серверные переменные окружения.</li><li>Применить модель данных из <code>docs/data-model.md</code>.</li><li>Настроить RLS: только администраторы изменяют книги, предметы и расписание.</li><li>Подключить защищённое Storage для разрешённых материалов и аватаров.</li></ol></div>;
}
