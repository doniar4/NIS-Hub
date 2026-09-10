import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { Notice, PageIntro } from "@/components/ui";

export default function SetupPage() {
  return <SiteShell><PageIntro kicker="Для владельца проекта" title="Подключение Supabase">Интерфейс готов к подключению. Учётные записи, библиотека и расписание появятся после настройки базы.</PageIntro><div className="mt-8"><Notice>Не вставляйте секретные ключи в чат или исходный код. Приложению нужен только публичный publishable key, не service_role.</Notice></div><ol className="prose-doc my-10 list-decimal space-y-5 pl-6"><li>Создайте отдельный проект Supabase для разработки.</li><li>В SQL Editor выполните <code>supabase/schema.sql</code>, затем <code>supabase/migrations/202609100001_phase2.sql</code>. Подробности и порядок проверки — в <code>docs/supabase-setup.md</code>.</li><li>Скопируйте <code>.env.example</code> в <code>.env.local</code> и заполните <code>NEXT_PUBLIC_SUPABASE_URL</code> и <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.</li><li>Настройте подтверждение email по инструкции, перезапустите приложение и зарегистрируйте тестовую учётную запись.</li><li>Назначьте администратора в SQL Editor. Добавьте классы и предметы, затем собственный PDF с подтверждённым правом на размещение.</li></ol><Link className="button" href="/login">Перейти ко входу</Link></SiteShell>;
}
