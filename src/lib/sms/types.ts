export type SmsErrorCode = "bad_credentials" | "session_expired" | "sms_unavailable" | "sms_changed" | "parse_failed" | "timeout" | "feature_disabled" | "interactive_required" | "invalid_input" | "busy";
export type SmsStudentContext = { displayName?: string; className?: string; schoolYear?: string; term?: string };
export type SmsAssessment = { subject: string; title?: string; type?: "formative" | "sor" | "soch" | "other"; date?: string; score?: number; max?: number; percent?: number; percentSource?: "official_display" | "derived" };
export type SmsSubjectSummary = { subject: string; percent?: number; percentSource?: "official_display" | "derived"; assessments: SmsAssessment[] };
export type SmsDiarySnapshot = { student: SmsStudentContext; subjects: SmsSubjectSummary[]; years?: string[]; terms?: string[]; fetchedAt: string };
export type SmsResult = { connected: boolean; snapshot?: SmsDiarySnapshot; error?: SmsErrorCode };
export type SmsCookie = { name: string; value: string; path: string; expires?: number };
export type SmsSession = { version: 1; expires: number; cookies: SmsCookie[] };
