import { getI18n } from "@/lib/i18n-server";
export default async function Loading() { const { t } = await getI18n(); return <main className="mx-auto max-w-6xl px-6 py-16" aria-busy="true"><p role="status">{t.loadingPage}</p></main>; }
