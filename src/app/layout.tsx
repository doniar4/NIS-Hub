import type { Metadata } from "next";
import "@fontsource-variable/outfit";
import "@fontsource-variable/noto-sans/wght.css";
import "./globals.css";
import "../styles/mobile.css";
import "../styles/auth-oauth.css";
import "../styles/admin.css";
import "../styles/install.css";
import "../styles/profile.css";
import "../styles/panels.css";
import { InstallProvider } from "@/components/install-provider";
import {experienceBootstrap} from "@/lib/experience";
import {FullLoadIntro} from "@/components/full-load-intro";
import { themeBootstrap } from "@/lib/theme";
import { getI18n } from "@/lib/i18n-server";
import { LocaleProvider } from "@/components/locale-provider";
import { SmoothScroll } from "@/components/smooth-scroll";
import { ParallaxBackground } from "@/components/parallax-background";
import { getSiteOrigin } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: { default: "NIS Hub", template: "%s · NIS Hub" },
  description: "NIS Hub brings schedules, books, homework, community and study tools together.",
  robots: { index: false, follow: false },
  applicationName: "NIS Hub",
  appleWebApp: { capable: true, title: "NIS Hub", statusBarStyle: "default" },
  // Next 16 emits mobile-web-app-capable for appleWebApp. Keep the iOS
  // compatibility directive through Metadata API, not a duplicate manual tag.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale } = await getI18n();
  return <html lang={locale} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap + ";" + experienceBootstrap }} /></head><body><LocaleProvider locale={locale}><FullLoadIntro/><SmoothScroll /><ParallaxBackground/><InstallProvider>{children}</InstallProvider></LocaleProvider></body></html>;
}
