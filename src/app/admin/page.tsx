import { AdminSetup } from "@/components/local-demo";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";

export default function AdminPage() { return <SiteShell><PageIntro kicker="Admin" title="Управление материалами">Этот раздел будет доступен только назначенным администраторам. Обычные пользователи не могут менять книги, предметы или расписание.</PageIntro><AdminSetup /></SiteShell>; }
