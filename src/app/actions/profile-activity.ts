"use server";
import { actionContext } from "@/lib/auth";
import type { ProfileActivity } from "@/lib/profile-activity";
import { getProfileActivity } from "@/lib/profile-activity-query";

export async function loadProfileActivity(): Promise<ProfileActivity | null> {
  try {
    const { supabase } = await actionContext();
    return getProfileActivity(supabase);
  } catch {
    return null;
  }
}
