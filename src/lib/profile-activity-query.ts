import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { parseProfileActivity, type ProfileActivity } from "./profile-activity";

export async function getProfileActivity(
  supabase: SupabaseClient<Database>,
): Promise<ProfileActivity | null> {
  try {
    const { data, error } = await supabase.rpc("profile_activity_year");
    return error ? null : parseProfileActivity(data);
  } catch {
    return null;
  }
}
