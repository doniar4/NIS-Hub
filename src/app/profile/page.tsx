import { CommunityNav } from "@/components/community-nav";
import { ProfilePortrait } from "@/components/profile-portrait";
import { AVATAR_URL_TTL_SECONDS } from "@/lib/avatar-policy";
import { getI18n } from "@/lib/i18n-server";
import { SiteShell } from "@/components/site-shell";
import { PageIntro } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { profileCopy, profileIsIncomplete } from "@/lib/profile-copy";
import { AvatarForm } from "@/components/avatar-form";
import { uploadAvatar } from "@/app/actions/avatar";
import { ReadingList } from "@/components/reading-list";
import { requireViewer } from "@/lib/auth";
import { database, getCatalogOptions } from "@/lib/queries";
import { getPersonalTasks } from "@/lib/task-queries";
import { TaskCenter } from "@/components/task-center";
import { InstallProfileEntry } from "@/components/install-discovery";
export default async function ProfilePage() {
  const { t, locale } = await getI18n();
  const pc = profileCopy(locale);
  const { user, profile } = await requireViewer("/profile");
  const incomplete = profileIsIncomplete(profile);
  const { classes, subjects } = await getCatalogOptions();
  const supabase = await database();
  const [{data:top,error},tasks] = await Promise.all([supabase.from("profile_top_subjects").select("subject_id,position").eq("profile_id", user.id).order("position"),getPersonalTasks()]);
  if (error) throw new Error("Не удалось загрузить избранные предметы.");
  const avatar =
    profile.avatar_path === `${user.id}/avatar.webp`
      ? await supabase.storage
          .from("avatars")
          .createSignedUrl(profile.avatar_path, AVATAR_URL_TTL_SECONDS)
      : null;
  return (
    <SiteShell>
      <div className="profile-heading surface-card">
        <ProfilePortrait
          url={avatar?.data?.signedUrl ?? null}
          name={profile.display_name ?? ""}
        />
        <div><PageIntro title={profile.display_name || t.profile}>{t.profileHint}</PageIntro><p className="profile-class">{classes.find(row=>row.id===profile.class_id)?.name}</p></div>
      </div>
      <CommunityNav locale={locale}/>
      <div className="profile-settings">
        <ProfileForm
          classes={classes}
          subjects={subjects}
          profile={{ display_name: profile.display_name, class_id: profile.class_id, bio: profile.bio }}
          top={[1, 2, 3, 4].map(
            (position) =>
              top.find((item) => item.position === position)?.subject_id ?? "",
          )}
          hasAvatar={!!profile.avatar_path}
        />
        <AvatarForm
          url={avatar?.data?.signedUrl ?? null}
          hasAvatar={!!profile.avatar_path}
          action={uploadAvatar}
          hidePreview
        />
      </div>
      {!incomplete && <TaskCenter initialTasks={tasks} subjects={subjects} collapsible label={pc.tasks}/>}
      <InstallProfileEntry />
      <div className="profile-reading mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="section-title border-b border-[var(--line)] pb-4">
            {t.continueReading}
          </h2>
          <ReadingList />
        </section>
        <section>
          <h2 className="section-title border-b border-[var(--line)] pb-4">
            {t.bookmarks}
          </h2>
          <ReadingList bookmarks />
        </section>
      </div>
    </SiteShell>
  );
}
