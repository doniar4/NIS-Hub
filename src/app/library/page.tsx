import { getI18n } from "@/lib/i18n-server";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { LibraryBrowser } from "@/components/library-browser";
import { getCatalogOptions } from "@/lib/queries";
import { getLibraryPage, getLibraryPersonal } from "@/lib/library-server";
import { classGrade } from "@/lib/book-model";
import { initialLibraryFilters } from "@/lib/library";
import { requireViewer } from "@/lib/auth";
import { changeLibrary } from "@/app/actions/library";
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getI18n();
  const { profile } = await requireViewer("/library");
  const params = await searchParams;
  const { classes, subjects } = await getCatalogOptions();
  const legacyClass =
    typeof params.classId === "string" ? params.classId : profile.class_id;
  const grade = classGrade(classes.find((c) => c.id === legacyClass));
  const initial = initialLibraryFilters(params, grade ? String(grade) : "");
  const [page, personal] = await Promise.all([
    getLibraryPage(initial),
    getLibraryPersonal(),
  ]);
  return (
    <SiteShell>
      <PageIntro kicker={t.materials} title={t.library}>
        {t.libraryHint}
      </PageIntro>
      <LibraryBrowser
        mutateAction={changeLibrary}
        studyIntent={params.study === "1"}
        key={JSON.stringify(initial)}
        page={page}
        personal={personal}
        subjects={subjects}
        initial={initial}
      />
    </SiteShell>
  );
}
