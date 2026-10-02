"use client";

import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import Link from "next/link";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/locale-provider";

export interface NotFoundProps { title?: string; description?: string }

export function Illustration(props: ComponentPropsWithoutRef<"svg">) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 362 145" {...props}>
    <path fill="currentColor" d="M62.6 142c-2.133 0-3.2-1.067-3.2-3.2V118h-56c-2 0-3-1-3-3V92.8c0-1.333.4-2.733 1.2-4.2L58.2 4c.8-1.333 2.067-2 3.8-2h28c2 0 3 1 3 3v85.4h11.2c.933 0 1.733.333 2.4 1 .667.533 1 1.267 1 2.2v21.2c0 .933-.333 1.733-1 2.4-.667.533-1.467.8-2.4.8H93v20.8c0 2.133-1.067 3.2-3.2 3.2H62.6zM33 90.4h26.4V51.2L33 90.4zM181.67 144.6c-7.333 0-14.333-1.333-21-4-6.666-2.667-12.866-6.733-18.6-12.2-5.733-5.467-10.266-13-13.6-22.6-3.333-9.6-5-20.667-5-33.2 0-12.533 1.667-23.6 5-33.2 3.334-9.6 7.867-17.133 13.6-22.6 5.734-5.467 11.934-9.533 18.6-12.2 6.667-2.8 13.667-4.2 21-4.2 7.467 0 14.534 1.4 21.2 4.2 6.667 2.667 12.8 6.733 18.4 12.2 5.734 5.467 10.267 13 13.6 22.6 3.334 9.6 5 20.667 5 33.2 0 12.533-1.666 23.6-5 33.2-3.333 9.6-7.866 17.133-13.6 22.6-5.6 5.467-11.733 9.533-18.4 12.2-6.666 2.667-13.733 4-21.2 4zm0-31c9.067 0 15.6-3.733 19.6-11.2 4.134-7.6 6.2-17.533 6.2-29.8s-2.066-22.2-6.2-29.8c-4.133-7.6-10.666-11.4-19.6-11.4-8.933 0-15.466 3.8-19.6 11.4-4 7.6-6 17.533-6 29.8s2 22.2 6 29.8c4.134 7.467 10.667 11.2 19.6 11.2zM316.116 142c-2.134 0-3.2-1.067-3.2-3.2V118h-56c-2 0-3-1-3-3V92.8c0-1.333.4-2.733 1.2-4.2l56.6-84.6c.8-1.333 2.066-2 3.8-2h28c2 0 3 1 3 3v85.4h11.2c.933 0 1.733.333 2.4 1 .666.533 1 1.267 1 2.2v21.2c0 .933-.334 1.733-1 2.4-.667.533-1.467.8-2.4.8h-11.2v20.8c0 2.133-1.067 3.2-3.2 3.2h-27.2zm-29.6-51.6h26.4V51.2l-26.4 39.2z" />
  </svg>;
}

const copy = {
  ru: { title:"Страница не найдена", description:"Возможно, она была перемещена или ссылка устарела.", back:"Назад", home:"На главную", support:"Обратиться в поддержку" },
  kk: { title:"Бет табылмады", description:"Бет көшірілген немесе сілтеме ескірген болуы мүмкін.", back:"Артқа", home:"Басты бетке", support:"Қолдау қызметіне хабарласу" },
  en: { title:"Page not found", description:"This page may have moved, or the link may be out of date.", back:"Go back", home:"Take me home", support:"Contact support" },
};

export function NotFound({ title, description }: NotFoundProps) {
  const { locale } = useI18n();
  const t = copy[locale];
  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
  }
  return <div className="nis-not-found-content">
    <h1>{title ?? t.title}</h1><p>{description ?? t.description}</p>
    <div className="nis-not-found-actions">
      <Button variant="secondary" asChild><Link href="/" onClick={goBack}><ArrowLeft size={16} aria-hidden="true" />{t.back}</Link></Button>
      <Button asChild><Link href="/">{t.home}</Link></Button>
    </div>
    <div className="nis-not-found-support"><Button variant="outline" asChild><Link href="/support"><LifeBuoy size={17} aria-hidden="true" />{t.support}</Link></Button></div>
  </div>;
}

export function NotFoundScreen(props: NotFoundProps) {
  return <main className="nis-not-found"><div className="nis-not-found-inner">
    <Illustration className="nis-not-found-art" aria-hidden="true" focusable="false" /><NotFound {...props} />
  </div></main>;
}
