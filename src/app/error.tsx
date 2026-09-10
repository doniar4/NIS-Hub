"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-6xl px-6 py-16"><h1 className="page-title">Не удалось загрузить страницу</h1><p className="my-6 max-w-xl text-[var(--muted)]">Проверьте подключение. Если ошибка повторяется, владельцу проекта нужно проверить переменные окружения и миграции Supabase.</p><div className="flex flex-wrap gap-4"><button className="button" onClick={reset}>Повторить</button><Link className="button button-secondary" href="/">На главную</Link></div></main>;
}
