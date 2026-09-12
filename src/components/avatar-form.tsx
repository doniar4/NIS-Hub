"use client";
import { useRouter } from "next/navigation";
import { AvatarPreview } from "./avatar-preview";
import { ActionForm } from "./action-form";
import { useI18n } from "./locale-provider";
import type { FormAction } from "@/lib/action-state";

export function AvatarForm({ url, action, hasAvatar = !!url }: { url: string | null; action: FormAction; hasAvatar?: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  return <section className="mt-10 max-w-2xl border-t border-[var(--line)] pt-6" aria-labelledby="avatar-heading">
    <h2 id="avatar-heading" className="section-title">{t.avatar}</h2>
    {hasAvatar && <AvatarPreview key={url ?? "unavailable"} url={url} onRetry={() => router.refresh()}/>}
    <p id="avatar-hint" className="my-4 text-sm text-[var(--muted)]">{t.avatarHint}</p>
    <ActionForm action={action} label={t.avatarUpload}>
      <label><span className="field-label">{t.avatarFile}</span><input className="field" type="file" name="avatar"
        accept="image/jpeg,image/png,image/webp" required aria-describedby="avatar-hint"/></label>
    </ActionForm>
  </section>;
}
