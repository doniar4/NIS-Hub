import { SiteShell } from "@/components/site-shell";
import { PencilStudyLoader } from "@/components/loaders/contextual-loaders";

export default function DiaryLoading() {
  return (
    <SiteShell>
      <div className="page-intro">
        <h1 className="page-title">Дневник</h1>
        <p className="page-description">Оценки и учебные достижения</p>
      </div>
      <PencilStudyLoader
        title="Загрузка дневника..."
        caption="Синхронизация оценок и предметов"
      />
    </SiteShell>
  );
}
