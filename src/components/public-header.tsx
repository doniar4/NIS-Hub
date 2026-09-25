import Link from "next/link";
import { changeLocale } from "@/app/actions/preferences";
import { getI18n } from "@/lib/i18n-server";
import { BrandMark } from "./brand";
import { PreferenceControls } from "./preference-controls";

export async function PublicHeader({ compact = false }: { compact?: boolean }) {
  const { t } = await getI18n();

  return <header className={compact ? "public-header public-header-compact" : "public-header"}>
    <Link className="public-brand" href="/" aria-label="NIS Hub">
      <BrandMark />
    </Link>
    <nav className="public-legal" aria-label={t.account}>
      <Link href="/privacy">{compact ? t.privacy : t.welcomePrivacy}</Link>
      <Link href="/terms">{compact ? t.terms : t.welcomeTerms}</Link>
    </nav>
    <PreferenceControls localeAction={changeLocale} localeFirst publicStyle />
  </header>;
}
