import { SiteShell } from "@/components/site-shell";
import { CardShimmerLoader } from "@/components/loaders/contextual-loaders";

export default function LibraryLoading() {
  return (
    <SiteShell>
      <div className="page-intro">
        <h1 className="page-title">Библиотека</h1>
        <p className="page-description">Учебные пособия и материалы</p>
      </div>
      <CardShimmerLoader count={6} title="Загрузка библиотеки..." />
    </SiteShell>
  );
}
