import type { Metadata } from "next";
import "./globals.css";
import { themeBootstrap } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "NIS Hub", template: "%s · NIS Hub" },
  description: "Учебные материалы, расписание и личные закладки.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body>{children}</body></html>;
}
