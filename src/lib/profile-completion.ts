import {schoolById} from "./schools";

export type CompletionProfile = {
 id:string;display_name:string|null;class_id:string|null;avatar_path:string|null;
 school_id?:string|null;onboarding_completed_at?:string|null;
};
export function profileCompletion(profile:CompletionProfile,top:readonly string[]) {
 const selected=top.filter(Boolean);
 return {
  school:!!schoolById(profile.school_id),
  name:!!profile.display_name?.trim(),
  cls:!!profile.class_id,
  avatar:profile.avatar_path===`${profile.id}/avatar.webp`,
  top:selected.length===4&&new Set(selected).size===4,
 };
}
export function canShowProfileActivity(profile:CompletionProfile,top:readonly string[]) {
 return !!profile.onboarding_completed_at&&Object.values(profileCompletion(profile,top)).every(Boolean);
}
