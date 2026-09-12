import { getI18n } from "@/lib/i18n-server";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { LibraryBrowser } from "@/components/library-browser";
import { getLibraryBooks, getCatalogOptions } from "@/lib/queries";
import { initialLibraryFilters } from "@/lib/library";
import { requireViewer } from "@/lib/auth";
export default async function LibraryPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getI18n();
  const { profile } = await requireViewer("/library");
  // Query parameters seed local state only; never constrain the initial DB load.
  const initial = initialLibraryFilters(await searchParams, profile.class_id ?? "");
  const [{ classes, subjects }, catalog] = await Promise.all([getCatalogOptions(), getLibraryBooks()]);
  return <SiteShell><PageIntro kicker={t.materials} title={t.library}>{t.libraryHint}</PageIntro>
    <LibraryBrowser books={catalog.books} truncated={catalog.truncated} classes={classes} subjects={subjects} initial={initial}/>
  </SiteShell>;
}
