import { SiteShell } from "@/components/site-shell";
import { PencilStudyLoader } from "@/components/loaders/contextual-loaders";

export default function BookLoading() {
  return (
    <SiteShell>
      <PencilStudyLoader
        title="Открываем книгу..."
        caption="Загрузка страниц и оглавления"
      />
    </SiteShell>
  );
}
