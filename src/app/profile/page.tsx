import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/fields";
import { ReadingList } from "@/components/reading-list";
import { requireViewer } from "@/lib/auth";
import { database, getCatalogOptions } from "@/lib/queries";
import { saveProfile } from "@/app/actions/profile";

export default async function ProfilePage() {
  const { user, profile } = await requireViewer("/profile");
  const { classes, subjects } = await getCatalogOptions();
  const supabase = await database();
  const { data: top, error } = await supabase.from("profile_top_subjects").select("subject_id,position").eq("profile_id", user.id).order("position");
  if (error) throw new Error("Не удалось загрузить избранные предметы.");
  return <SiteShell><PageIntro kicker="Только для вас" title="Профиль">Ваш класс и любимые предметы. Профиль виден только вам.</PageIntro><ActionForm action={saveProfile} label="Сохранить профиль" className="mt-8 max-w-2xl space-y-6"><div className="grid gap-5 sm:grid-cols-2"><Field label="Отображаемое имя" name="display_name" defaultValue={profile.display_name ?? ""} required maxLength={60} autoComplete="nickname" /><SelectField label="Класс" name="class_id" options={classes} value={profile.class_id} /></div><fieldset className="space-y-3"><legend className="section-title mb-3">Top 4</legend><p className="text-sm text-[var(--muted)]">До четырёх разных предметов в выбранном порядке.</p><div className="grid gap-4 sm:grid-cols-2">{[1,2,3,4].map(position => <SelectField key={position} label={"Предмет " + position} name="subjects" options={subjects} value={top.find(item => item.position === position)?.subject_id} />)}</div></fieldset></ActionForm><div className="mt-14 grid gap-10 lg:grid-cols-2"><section><h2 className="section-title border-b border-[var(--line)] pb-4">Продолжить чтение</h2><ReadingList /></section><section><h2 className="section-title border-b border-[var(--line)] pb-4">Закладки</h2><ReadingList bookmarks /></section></div></SiteShell>;
}
