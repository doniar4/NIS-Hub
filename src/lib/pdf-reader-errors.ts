export function isRenderCancellation(reason: unknown): boolean {
  return reason !== null && typeof reason === "object" && "name" in reason && reason.name === "RenderingCancelledException";
}

// Keep useful PDF.js exception messages, but never serialize Error objects,
// documents, request objects, stacks, signed URLs, API keys or session tokens.
export function pdfErrorDetail(reason: unknown): string {
  if (!(reason instanceof Error)) return "Unknown PDF.js error";
  return `${reason.name}: ${reason.message}`
    .replace(/(?:https?:\/\/|blob:|data:)[^\s"'<>]+/gi, "[URL]")
    .replace(/\b(?:sb_(?:secret|publishable)_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, "[REDACTED]")
    .replace(/\b(token|access_token|refresh_token|authorization|apikey)\b\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .slice(0, 500);
}

export function reportPdfError(stage: "load" | "render" | "text" | "cleanup", reason: unknown, page?: number): string {
  if (process.env.NODE_ENV !== "development" || isRenderCancellation(reason)) return "";
  const detail = pdfErrorDetail(reason);
  console.error("[NIS Reader] PDF.js failure", { stage, page, detail });
  return detail;
}
