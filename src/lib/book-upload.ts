export const BOOK_PDF_BYTES = 52_428_800;
export function pdfFileIssue(file: { name: string; type: string; size: number }): "pdfLarge" | "pdfInvalid" | null {
  if (file.size > BOOK_PDF_BYTES) return "pdfLarge";
  if (!Number.isSafeInteger(file.size) || file.size < 5 || !/\.pdf$/i.test(file.name) ||
    (file.type && file.type !== "application/pdf")) return "pdfInvalid";
  return null;
}
export async function validatePdfFile(file: File) {
  const issue = pdfFileIssue(file);
  if (issue) return issue;
  // Header sniffing is not malware scanning. Only trusted administrators upload.
  const header = new TextDecoder("latin1").decode(await file.slice(0, 1024).arrayBuffer());
  return header.includes("%PDF-") ? null : "pdfInvalid";
}
export const canonicalBookPath = (id: string) => "books/" + id + ".pdf";
