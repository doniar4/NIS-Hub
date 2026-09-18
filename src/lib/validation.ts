import { z } from "zod";

export const uuid = z.uuid("Некорректный идентификатор.");
const optionalText = (max: number) => z.string().trim().max(max).transform(value => value || null);
const optionalId = z.union([uuid, z.literal("")]).transform(value => value || null);
const optionalInt = (min: number, max: number) => z.union([z.literal(""), z.coerce.number().int().min(min).max(max)]).transform(value => value === "" ? null : value);
export const dateSchema = z.iso.date("Укажите существующую дату.");
export const pageSchema = z.coerce.number().int().min(1).max(100000);
export const credentialsSchema = z.object({ email: z.email("Проверьте email.").max(254), password: z.string().min(8, "Минимум 8 символов.").max(128) });
export const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Введите имя.").max(60),
  class_id: optionalId,
  subjects: z.array(uuid).max(4).refine(values => new Set(values).size === values.length, "Выберите разные предметы."),
});
export const pdfPathSchema = z.string().min(1).max(500).regex(/^[A-Za-z0-9_-][A-Za-z0-9/_-]*\.pdf$/, "Укажите путь к PDF внутри book-files, например books/sample.pdf.");
export const bookSchema = z.object({
  id: optionalId, title: z.string().trim().min(1).max(200), subject_id: uuid, class_id: optionalId,
  author: optionalText(200), publisher: optionalText(200), publication_year: optionalInt(1000, 9999), language: optionalText(40),
  file_path: pdfPathSchema, page_count: optionalInt(1, 100000),
  publication_status: z.enum(["draft", "published", "archived"]),
});
export const classSchema = z.object({ id: optionalId, name: z.string().trim().min(1).max(40), grade: optionalInt(1,12), section: optionalText(10) });
export const subjectSchema = z.object({ id: optionalId, name: z.string().trim().min(1).max(100), name_ru: z.string().trim().min(1).max(100), name_kz: z.string().trim().min(1).max(100), name_en: z.string().trim().min(1).max(100), short_name: optionalText(30) });
export const lessonSchema = z.object({ id: optionalId, class_id: uuid, date: dateSchema, lesson_number: z.coerce.number().int().min(1).max(20), subject_id: uuid, teacher: optionalText(100), room: optionalText(40) });
export const adminEntitySchema = z.enum(["books", "classes", "subjects", "schedule"]);

// A closed redirect allowlist also rejects protocol-relative URLs and encodings.
export function safeNext(value: unknown): string {
  return typeof value === "string" && /^\/(?:profile|admin|library|schedule|messages|diary|support(?:\/[0-9a-f-]+)?|books\/[0-9a-f-]+(?:\/read)?)$/.test(value) ? value : "/profile";
}
export function canReadBook(book: { publication_status: string }) {
  return book.publication_status === "published";
}
export function schoolDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Oral", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
