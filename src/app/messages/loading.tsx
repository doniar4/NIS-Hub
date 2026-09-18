import { SiteShell } from "@/components/site-shell";
import { ChatSkeletonLoader } from "@/components/loaders/contextual-loaders";

export default function MessagesLoading() {
  return (
    <SiteShell>
      <div className="page-intro">
        <h1 className="page-title">Сообщения</h1>
        <p className="page-description">Личные диалоги</p>
      </div>
      <ChatSkeletonLoader title="Загрузка сообщений..." subtitle="Синхронизация диалогов" />
    </SiteShell>
  );
}
