import type { SmsErrorCode } from "./types";
export type SmsFailureReason = "password_change" | "authenticator_enrollment" | "domain_captcha" | "unknown_challenge" | "manual_challenge";
export class SmsError extends Error {
  constructor(public readonly code: SmsErrorCode, public readonly reason?: SmsFailureReason) { super(code); this.name = "SmsError"; }
}
// Never include provider bodies, request values, URLs, headers or caught messages.
export function safeSmsError(error: unknown): SmsErrorCode {
  return error instanceof SmsError ? error.code : "sms_unavailable";
}
export function reportSmsFailure(error: unknown) {
  if (process.env.VERCEL !== "1" || !(error instanceof SmsError) || !error.reason) return;
  // Deliberately exclude account IDs, credentials, cookies, URLs and provider data.
  console.warn("[sms] provider verification required", {
    code: error.code,
    reason: error.reason,
    region: process.env.VERCEL_REGION || "unknown",
  });
}
