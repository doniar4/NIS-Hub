"use client";
import { createContext, useContext, type ReactNode } from "react";
import { dictionaries, type Locale } from "@/lib/i18n";
const LocaleContext = createContext<Locale>("ru");
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) { return <LocaleContext value={locale}>{children}</LocaleContext>; }
export function useI18n() { const locale = useContext(LocaleContext); return { locale, t: dictionaries[locale] }; }
