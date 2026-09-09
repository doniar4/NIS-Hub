import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { ReaderDemo } from "@/components/local-demo";
import { SiteShell } from "@/components/site-shell";
import { Notice, PageIntro } from "@/components/ui";

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== "demo") return <SiteShell><p>Материал не найден.</p><Link className="mt-6 inline-flex items-center gap-2 underline" href="/library"><ArrowLeftIcon size={17} />Библиотека</Link></SiteShell>;
  return <SiteShell><Link className="inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline" href="/books/demo"><ArrowLeftIcon size={17} />К техническому документу</Link><div className="mt-8"><PageIntro kicker="Reader test" title="Рабочая проверка reader">Навигация и закладки работают локально в браузере. Производственный PDF-viewer появится после подключения защищённого файлового хранилища.</PageIntro></div><div className="mt-8"><Notice>Не используйте этот reader для материалов без подтверждённых прав. Здесь нет и не будет случайных PDF из интернета.</Notice></div><ReaderDemo /></SiteShell>;
}
