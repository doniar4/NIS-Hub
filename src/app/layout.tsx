import type { Metadata } from "next";
import "./globals.css";
import { themeBootstrap } from "@/lib/theme";
import { getI18n } from "@/lib/i18n-server";
import { LocaleProvider } from "@/components/locale-provider";

export const metadata: Metadata = {
  title: { default: "NIS Hub", template: "%s · NIS Hub" },
  description: "Учебные материалы, расписание и личные закладки.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale } = await getI18n();
  return <html lang={locale} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body><LocaleProvider locale={locale}>{children}</LocaleProvider></body></html>;
}
