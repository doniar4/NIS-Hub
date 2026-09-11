"use server";

import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { normalizeAvatar, persistAvatar } from "@/lib/avatar";
import type { ActionState } from "@/lib/action-state";

export async function uploadAvatar(_state: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  let context: Awaited<ReturnType<typeof actionContext>>;
  try { context = await actionContext(); } catch { return { error: t.sessionError }; }
  const file = form.get("avatar");
  if (!(file instanceof File)) return { error: t.avatarInvalid };
  let bytes: Buffer;
  try { bytes = await normalizeAvatar(file); } catch { return { error: t.avatarInvalid }; }
  const { supabase, user } = context;
  const result = await persistAvatar(user.id, bytes, {
    upload: async (path, data) => {
      const { error } = await supabase.storage.from("avatars").upload(path, data, { upsert: true, contentType: "image/webp", cacheControl: "0" });
      return !error;
    },
    savePath: async path => {
      const { data, error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id).select("id").single();
      return !error && !!data;
    },
  });
  if (result === "uploadFailed") return { error: t.avatarUploadError };
  revalidatePath("/profile");
  if (result === "profileFailed") return { error: t.avatarPartial };
  return { success: t.avatarSaved };
}
