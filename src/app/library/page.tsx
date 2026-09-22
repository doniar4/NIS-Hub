import { getI18n } from "@/lib/i18n-server";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { LibraryBrowser } from "@/components/library-browser";
import { getLibraryBooks, getCatalogOptions } from "@/lib/queries";
import {classGrade} from "@/lib/book-model";
import { initialLibraryFilters } from "@/lib/library";
import { requireViewer } from "@/lib/auth";
export default async function LibraryPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getI18n();
  const { profile } = await requireViewer("/library");
  // Query parameters seed local state only; never constrain the initial DB load.
  const params = await searchParams;
  const [{ classes, subjects }, catalog] = await Promise.all([getCatalogOptions(), getLibraryBooks()]);
  const legacyClass = typeof params.classId==="string" ? params.classId : profile.class_id;
  const grade=classGrade(classes.find(c=>c.id===legacyClass));
  const initial = initialLibraryFilters(params,grade?String(grade):"");
  return <SiteShell><PageIntro kicker={t.materials} title={t.library}>{t.libraryHint}</PageIntro>
    <LibraryBrowser studyIntent={params.study==="1"} key={JSON.stringify(initial)} books={catalog.books} truncated={catalog.truncated} classes={classes} subjects={subjects} initial={initial}/>
  </SiteShell>;
}
