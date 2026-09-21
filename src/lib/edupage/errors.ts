export type EduPageErrorCode = "disabled" | "login_required" | "unavailable" | "timeout" | "source_changed" | "unsupported" | "mapping" | "conflict" | "stale" | "confirmation" | "database" | "admin" | "busy";
export class EduPageError extends Error {
  constructor(readonly code: EduPageErrorCode) { super(code); this.name = "EduPageError"; }
}
export const safeEduPageError = (error: unknown): EduPageErrorCode =>
  error instanceof EduPageError ? error.code : "unavailable";
