import Link from "next/link";
import { BookIcon } from "@/components/icons";
import { SiteShell } from "@/components/site-shell";
import { EmptyState, Notice, PageIntro } from "@/components/ui";

export default function LibraryPage() {
  return <SiteShell><PageIntro kicker="Library" title="Библиотека">Каталог покажет только материалы с подтверждённым правом на публикацию.</PageIntro><div className="mt-10"><Notice>В этой версии каталог намеренно пуст. Нельзя добавлять учебники, найденные в интернете, без подтверждённой лицензии или разрешения.</Notice></div><div className="mt-10"><EmptyState title="Нет опубликованных материалов">Подключите защищённое хранилище и добавьте в админке только проверенные записи. Для проверки reader доступен собственный технический документ — он не является учебником.<div className="mt-6"><Link className="button button-secondary" href="/books/demo/read"><BookIcon size={17} />Открыть тестовый reader</Link></div></EmptyState></div><section className="mt-14 border-t border-[var(--line)] pt-7"><h2 className="text-xl font-semibold tracking-[-0.02em]">Когда каталог будет подключён</h2><div className="mt-5 grid gap-4 sm:grid-cols-3">{["Поиск и предметы", "Статус публикации", "Понятные пустые и error states"].map((item) => <div className="border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)]" key={item}>{item}</div>)}</div></section></SiteShell>;
}
