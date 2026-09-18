import { requireViewer } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { communityCopy } from "@/lib/community-copy";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { MessagesPanel } from "@/components/messages-panel";
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { user } = await requireViewer("/messages"),
    { locale } = await getI18n(),
    p = communityCopy(locale),
    { thread } = await searchParams;
  return (
    <SiteShell>
      <PageIntro title={p.messages}>{p.privateChat}</PageIntro>
      <MessagesPanel
        key={thread ?? "inbox"}
        userId={user.id}
        initialThread={thread}
      />
    </SiteShell>
  );
}
