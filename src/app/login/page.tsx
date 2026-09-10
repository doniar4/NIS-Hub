import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PageIntro, Notice } from "@/components/ui";
import { AuthForm } from "@/components/auth-form";
import { getViewer } from "@/lib/auth";
import { safeNext } from "@/lib/validation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await getViewer();
  const params = await searchParams;
  const next = safeNext(params.next);
  if (viewer.user) redirect(next);
  return <SiteShell><PageIntro kicker="Аккаунт" title="Войти">Откройте библиотеку и свои сохранённые страницы.</PageIntro>{!viewer.configured && <div className="mt-6"><Notice>Вход пока недоступен: владелец проекта ещё не подключил аккаунты. <Link className="underline" href="/setup">Настройка проекта</Link></Notice></div>}{params.confirmation === "failed" && <p className="form-error mt-6" role="alert">Ссылка подтверждения недействительна или истекла. Повторите регистрацию или обратитесь к администратору.</p>}<AuthForm mode="login" next={next} configured={viewer.configured} /><p className="mt-5 text-sm">Нет аккаунта? <Link className="underline" href="/signup">Создать аккаунт</Link></p></SiteShell>;
}
