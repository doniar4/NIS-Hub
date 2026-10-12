"use client";
import "../styles/fonts.css";
import "./globals.css";
import { useEffect, useSyncExternalStore } from "react";
import { LocaleProvider } from "@/components/locale-provider";
import { ErrorScreen } from "@/components/ui/error-screen";
import { LOCALE_COOKIE, parseLocale, type Locale } from "@/lib/i18n";
import { fontBootstrap } from "@/lib/font-fallback";
import { themeBootstrap } from "@/lib/theme";

const subscribe = () => () => {};
const readLocale = (): Locale => parseLocale(document.cookie.split("; ").find(part => part.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1]);
const serverLocale = (): Locale => "ru";

// Replaces the root layout when it crashes, so it re-creates theme, styles and locale itself.
export default function GlobalError({ error, retry, reset }: {
    error: Error & { digest?: string };
    retry?: () => void;
    reset?: () => void;
}) {
    const locale = useSyncExternalStore(subscribe, readLocale, serverLocale);
    useEffect(() => { console.error(error); }, [error]);
    return <html lang={locale} suppressHydrationWarning>
        <head><script dangerouslySetInnerHTML={{ __html: fontBootstrap + ";" + themeBootstrap }} /></head>
        <body><LocaleProvider locale={locale}><ErrorScreen onRetry={() => (retry ?? reset)?.()} /></LocaleProvider></body>
    </html>;
}
