import { AVATAR_URL_TTL_SECONDS } from "@/lib/avatar-policy";
import { getI18n } from "@/lib/i18n-server";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/fields";
import { AvatarForm } from "@/components/avatar-form";
import { uploadAvatar } from "@/app/actions/avatar";
import { TopSubjects } from "@/components/top-subjects";
import { ReadingList } from "@/components/reading-list";
import { requireViewer } from "@/lib/auth";
import { database, getCatalogOptions } from "@/lib/queries";
import { saveProfile } from "@/app/actions/profile";
export default async function ProfilePage() {
    const { t } = await getI18n();
    const { user, profile } = await requireViewer("/profile");
    const { classes, subjects } = await getCatalogOptions();
    const supabase = await database();
    const { data: top, error } = await supabase.from("profile_top_subjects").select("subject_id,position").eq("profile_id", user.id).order("position");
    if (error)
        throw new Error("Не удалось загрузить избранные предметы.");
    const avatar = profile.avatar_path === `${user.id}/avatar.webp` ? await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, AVATAR_URL_TTL_SECONDS) : null;
    return <SiteShell><PageIntro kicker={t.onlyYou} title={t.profile}>{t.profileHint}</PageIntro><ActionForm action={saveProfile} label={t.saveProfile} className="mt-8 max-w-2xl space-y-6"><div className="grid gap-5 sm:grid-cols-2"><Field label={t.displayName} name="display_name" defaultValue={profile.display_name ?? ""} required maxLength={60} autoComplete="nickname"/><SelectField label={t.class} name="class_id" options={classes} value={profile.class_id}/></div><TopSubjects subjects={subjects} initial={[1, 2, 3, 4].map(position => top.find(item => item.position === position)?.subject_id ?? "")}/></ActionForm><AvatarForm url={avatar?.data?.signedUrl ?? null} hasAvatar={!!profile.avatar_path} action={uploadAvatar}/><div className="mt-14 grid gap-10 lg:grid-cols-2"><section><h2 className="section-title border-b border-[var(--line)] pb-4">{t.continueReading}</h2><ReadingList /></section><section><h2 className="section-title border-b border-[var(--line)] pb-4">{t.bookmarks}</h2><ReadingList bookmarks/></section></div></SiteShell>;
}
