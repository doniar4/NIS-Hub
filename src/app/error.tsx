"use client";
import { useEffect } from "react";
import { ErrorScreen } from "@/components/ui/error-screen";
export default function ErrorPage({ error, retry, reset }: {
    error: Error & {
        digest?: string;
    };
    retry?: () => void;
    reset?: () => void;
}) {
    useEffect(() => { console.error(error); }, [error]);
    return <ErrorScreen onRetry={() => (retry ?? reset)?.()} />;
}
