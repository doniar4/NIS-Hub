import type { SmsErrorCode } from "./types";
export class SmsError extends Error {
  constructor(public readonly code: SmsErrorCode) { super(code); this.name = "SmsError"; }
}
// Never include provider bodies, request values, URLs, headers or caught messages.
export function safeSmsError(error: unknown): SmsErrorCode {
  return error instanceof SmsError ? error.code : "sms_unavailable";
}
