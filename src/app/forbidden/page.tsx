import { getI18n } from "@/lib/i18n-server";
import { SiteShell } from "@/components/site-shell";
import { EmptyState } from "@/components/ui";
export default async function ForbiddenPage() { const { t } = await getI18n(); return <SiteShell><h1 className="page-title mb-8">{t.forbidden}</h1><EmptyState title={t.adminRequired} action={{ href: "/profile", label: t.profile }}>{t.forbiddenHint}</EmptyState></SiteShell>; }
