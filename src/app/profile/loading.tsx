import { SiteShell } from "@/components/site-shell";
import { CardShimmerLoader } from "@/components/loaders/contextual-loaders";

export default function ProfileLoading() {
  return (
    <SiteShell>
      <div className="page-intro">
        <h1 className="page-title">Профиль</h1>
        <p className="page-description">Настройки и учебные данные</p>
      </div>
      <CardShimmerLoader count={3} title="Загрузка профиля..." />
    </SiteShell>
  );
}
