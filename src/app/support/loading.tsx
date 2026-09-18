import { SiteShell } from "@/components/site-shell";
import { ChatSkeletonLoader } from "@/components/loaders/contextual-loaders";
import { getI18n } from "@/lib/i18n-server";
import { v05Copy } from "@/lib/v05-copy";

export default async function SupportLoading() {
  const { locale } = await getI18n();
  const p = v05Copy(locale);
  return (
    <SiteShell>
      <div className="page-intro">
        <h1 className="page-title">{p.support}</h1>
      </div>
      <ChatSkeletonLoader kind="support" />
    </SiteShell>
  );
}
