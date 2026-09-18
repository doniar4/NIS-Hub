import { SiteShell } from "@/components/site-shell";
import { CardShimmerLoader } from "@/components/loaders/contextual-loaders";
import { getI18n } from "@/lib/i18n-server";

export default async function LibraryLoading() {
  const { t } = await getI18n();
  return (
    <SiteShell>
      <div className="page-intro">
        <h1 className="page-title">{t.library}</h1>
      </div>
      <CardShimmerLoader count={6} kind="library" />
    </SiteShell>
  );
}
