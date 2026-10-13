"use client";

import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { LifeBuoy, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/locale-provider";

export interface ErrorScreenProps { onRetry: () => void; title?: string; description?: string }

// Same canvas as the 404 illustration so both status screens share one layout.
export function ErrorIllustration(props: ComponentPropsWithoutRef<"svg">) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 362 145" overflow="visible" {...props}>
    <text x="0" y="141" textLength="362" lengthAdjust="spacingAndGlyphs" fill="currentColor" style={{ font: "800 186px/1 var(--font-body)" }}>500</text>
  </svg>;
}

const copy = {
  ru: { support: "Обратиться в поддержку" },
  kk: { support: "Қолдау қызметіне хабарласу" },
  en: { support: "Contact support" },
};

export function ErrorScreen({ onRetry, title, description }: ErrorScreenProps) {
  const { locale, t } = useI18n();
  return <main className="nis-not-found"><div className="nis-not-found-inner">
    <ErrorIllustration className="nis-not-found-art" aria-hidden="true" focusable="false" />
    <div className="nis-not-found-content" role="alert">
      <h1>{title ?? t.pageError}</h1><p>{description ?? t.pageErrorHint}</p>
      <div className="nis-not-found-actions">
        <Button variant="secondary" onClick={onRetry}><RotateCw size={16} aria-hidden="true" />{t.retry}</Button>
        <Button asChild><Link href="/">{t.backHome}</Link></Button>
      </div>
      <div className="nis-not-found-support"><Button variant="outline" asChild><Link href="/support">
        <LifeBuoy size={17} aria-hidden="true" />{copy[locale].support}
      </Link></Button></div>
    </div>
  </div></main>;
}
