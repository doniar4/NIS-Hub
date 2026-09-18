import { SiteShell } from "@/components/site-shell";
import { ChatSkeletonLoader } from "@/components/loaders/contextual-loaders";
import { getI18n } from "@/lib/i18n-server";
import { communityCopy } from "@/lib/community-copy";

export default async function MessagesLoading() {
  const { locale } = await getI18n();
  const c = communityCopy(locale);
  return (
    <SiteShell>
      <div className="page-intro">
        <h1 className="page-title">{c.messages}</h1>
      </div>
      <ChatSkeletonLoader kind="messages" />
    </SiteShell>
  );
}
