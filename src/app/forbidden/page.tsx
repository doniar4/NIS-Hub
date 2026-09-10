import { SiteShell } from "@/components/site-shell";
import { EmptyState } from "@/components/ui";
export default function ForbiddenPage() { return <SiteShell><h1 className="page-title mb-8">Доступ ограничен</h1><EmptyState title="Нужна роль администратора" action={{ href: "/profile", label: "В личный кабинет" }}>Этот аккаунт не может управлять учебными материалами и расписанием.</EmptyState></SiteShell>; }
