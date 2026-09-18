import { SiteShell } from "@/components/site-shell";
import { ChatSkeletonLoader } from "@/components/loaders/contextual-loaders";

export default function SupportLoading() {
  return (
    <SiteShell>
      <div className="page-intro">
        <h1 className="page-title">Обращения</h1>
        <p className="page-description">Служба поддержки и вопросы</p>
      </div>
      <ChatSkeletonLoader title="Загрузка обращений..." subtitle="Проверка заявок и ответов" />
    </SiteShell>
  );
}
