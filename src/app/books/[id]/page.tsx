import Link from "next/link";
import { ArrowRightIcon, BookIcon } from "@/components/icons";
import { SiteShell } from "@/components/site-shell";
import { EmptyState, PageIntro } from "@/components/ui";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== "demo") return <SiteShell><EmptyState title="Материал не найден">Запись отсутствует или ещё не опубликована.<div className="mt-6"><Link className="button button-secondary" href="/library">Вернуться в библиотеку</Link></div></EmptyState></SiteShell>;
  return <SiteShell><PageIntro kicker="Technical test document" title="Проверка reader">Собственный документ проекта. Это не учебник, не публичный материал и не часть будущего каталога.</PageIntro><dl className="mt-10 grid max-w-2xl divide-y divide-[var(--line)] border-y border-[var(--line)] text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0">{[["Статус", "Только для тестирования"], ["Формат", "Внутренний документ"], ["Автор", "—"], ["Право на публикацию", "Не применимо: не публикуется"]].map(([term, value]) => <div className="p-5" key={term}><dt className="text-[var(--muted)]">{term}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl><Link className="button mt-8" href="/books/demo/read"><BookIcon size={17} />Открыть reader<ArrowRightIcon size={17} /></Link></SiteShell>;
}
