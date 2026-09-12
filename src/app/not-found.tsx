import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
export default async function NotFound() { const { t } = await getI18n(); return <main className="mx-auto max-w-6xl px-6 py-16"><p className="mb-4 text-sm text-[var(--muted)]">NIS Hub · 404</p><h1 className="page-title">{t.notFound}</h1><p className="my-6">{t.notFoundHint}</p><Link className="button" href="/library">{t.backLibrary}</Link></main>; }
