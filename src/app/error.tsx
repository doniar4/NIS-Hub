"use client";
import { useI18n } from "@/components/locale-provider";
import Link from "next/link";
export default function ErrorPage({ reset }: {
    error: Error & {
        digest?: string;
    };
    reset: () => void;
}) {
    const { t } = useI18n();
    return <main className="mx-auto max-w-6xl px-6 py-16"><h1 className="page-title">{t.pageError}</h1><p className="my-6 max-w-xl text-[var(--muted)]">{t.pageErrorHint}</p><div className="flex flex-wrap gap-4"><button className="button" onClick={reset}>{t.retry}</button><Link className="button button-secondary" href="/">{t.backHome}</Link></div></main>;
}
