"use client";
import { useI18n } from "@/components/locale-provider";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveReading } from "@/app/actions/reading";
export function BookmarkRemove({ bookId, page }: {
    bookId: string;
    page: number;
}) {
    const { t } = useI18n();
    const [error, setError] = useState("");
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    return <div><button className="button button-secondary" disabled={pending} onClick={() => startTransition(async () => {
            try {
                const result = await saveReading(bookId, page, "remove");
                setError(result.error ?? "");
                if (!result.error)
                    router.refresh();
            }
            catch {
                setError(t.saveError);
            }
        })}>{pending ? t.removing : t.removeBookmark}</button>{error && <p role="alert" className="form-error">{error}</p>}</div>;
}
