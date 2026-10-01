export type SocialProvider = "google" | "azure";

/** Explicit rollout flags: never show an OAuth control before its provider is configured. */
export function socialProviderEnabled(provider: SocialProvider): boolean {
  if (provider === "google") return process.env.GOOGLE_AUTH_ENABLED === "true";
  if (provider === "azure") return process.env.AZURE_AUTH_ENABLED === "true";
  return false;
}

export function allowedSocialProvider(value: unknown): value is SocialProvider {
  return value === "google" || value === "azure";
}
