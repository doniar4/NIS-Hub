import { ProfileEditor } from "@/components/local-demo";
import { SiteShell } from "@/components/site-shell";
import { Notice, PageIntro } from "@/components/ui";

export default function ProfilePage() {
  return <SiteShell><PageIntro kicker="Profile" title="Учебный профиль">Настройте отображаемое имя, класс и четыре любимых предмета.</PageIntro><div className="mt-8"><Notice>Пока нет авторизации: это локальный черновик профиля и он не виден другим людям.</Notice></div><ProfileEditor /></SiteShell>;
}
