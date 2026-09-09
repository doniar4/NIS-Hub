import Link from "next/link";
import { AuthForm } from "@/components/local-demo";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";

export default function LoginPage() { return <SiteShell><PageIntro kicker="Authentication" title="Войти">Авторизация будет доступна после безопасного подключения Supabase Auth.</PageIntro><AuthForm mode="login" /><p className="mt-5 text-sm text-[var(--muted)]">Нет аккаунта? <Link className="font-semibold text-[var(--ink)] underline" href="/signup">Создать аккаунт</Link></p></SiteShell>; }
