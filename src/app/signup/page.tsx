import Link from "next/link";
import { AuthForm } from "@/components/local-demo";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";

export default function SignupPage() { return <SiteShell><PageIntro kicker="Authentication" title="Создать аккаунт">Сначала ознакомьтесь с тем, какие данные будут необходимы для этой функции.</PageIntro><AuthForm mode="signup" /><p className="mt-5 text-sm text-[var(--muted)]">Уже есть аккаунт? <Link className="font-semibold text-[var(--ink)] underline" href="/login">Войти</Link></p></SiteShell>; }
