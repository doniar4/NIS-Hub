import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PageIntro, Notice } from "@/components/ui";
import { AuthForm } from "@/components/auth-form";
import { getViewer } from "@/lib/auth";

export default async function SignupPage() {
  const viewer = await getViewer();
  if (viewer.user) redirect("/profile");
  return <SiteShell><PageIntro kicker="Аккаунт" title="Создать аккаунт">Для регистрации нужны email и пароль. Класс можно выбрать позже.</PageIntro>{!viewer.configured && <div className="mt-6"><Notice>Регистрация ещё не открыта. Владелец проекта завершает настройку аккаунтов.</Notice></div>}<AuthForm mode="signup" next="/profile" configured={viewer.configured} /><p className="mt-5 text-sm">Уже есть аккаунт? <Link className="underline" href="/login">Войти</Link></p></SiteShell>;
}
