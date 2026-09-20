import { getCatalogOptions } from "@/lib/queries";
import { PublicProfile } from "@/components/public-profile";
import { requireViewer } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { v053Copy } from "@/lib/v053-copy";
import { findPeople } from "@/app/actions/people";
import { SiteShell } from "@/components/site-shell";
import { CommunityNav } from "@/components/community-nav";

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { id } = await params;
  await requireViewer("/people/" + id);
  const { locale } = await getI18n(),
    p = v053Copy(locale),
    result = await findPeople("profile", "", id);
  const { thread } = await searchParams;
  const { subjects } = await getCatalogOptions();
  const person = "data" in result ? result.data[0] : null;
  return (
    <SiteShell>
      <CommunityNav locale={locale} />
      {person ? (
        <PublicProfile
          person={person}
          subjects={subjects}
          locale={locale}
          thread={thread}
        />
      ) : (
        <p role="status">
          {"error" in result ? p[result.error] : p.unavailable}
        </p>
      )}
    </SiteShell>
  );
}
