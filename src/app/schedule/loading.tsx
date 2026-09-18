import { SiteShell } from "@/components/site-shell";
import { PencilStudyLoader } from "@/components/loaders/contextual-loaders";

export default function ScheduleLoading() {
  return (
    <SiteShell>
      <div className="page-intro">
        <h1 className="page-title">Расписание</h1>
        <p className="page-description">Учебный день и расписание уроков</p>
      </div>
      <PencilStudyLoader
        title="Загрузка расписания..."
        caption="Подготовка уроков и кабинетов на неделю"
      />
    </SiteShell>
  );
}
