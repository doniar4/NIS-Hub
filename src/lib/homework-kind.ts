import type { ClassHomework } from "./database.types";
import type { Locale } from "./i18n";

export type HomeworkKind = "homework" | "sor";

// Older responses and Telegram entries may still carry the category in the text.
export function homeworkKind(row: Pick<ClassHomework, "body" | "kind">): HomeworkKind {
  if (row.kind) return row.kind;
  return /^(?:сор|sor|бжб)(?=$|[^\p{L}\p{N}_])/iu.test(row.body.trim()) ? "sor" : "homework";
}

export function homeworkKindCopy(locale: Locale) {
  return locale === "kk" ? {
    category: "Тапсырма түрі", homework: "Үй тапсырмасы", sor: "БЖБ", soch: "ТЖБ",
    sorDescription: "Бөлім бойынша жиынтық бағалау", body: "Тапсырма", topics: "Тақырыптар немесе ескертпе", optional: "Міндетті емес",
    hint: "БЖБ белгісі сабақта автоматты түрде көрсетіледі.", placeholder: "Қайталауға арналған тақырыптар, бөлім немесе беттер…",
  } : locale === "en" ? {
    category: "Assignment category", homework: "Homework", sor: "SOR", soch: "SOCH",
    sorDescription: "Summative assessment for the section", body: "Assignment", topics: "Topics or a note", optional: "Optional",
    hint: "The SOR badge will appear on the lesson automatically.", placeholder: "Topics to revise, chapter or pages…",
  } : {
    category: "Категория задания", homework: "Домашнее задание", sor: "СОР", soch: "СОЧ",
    sorDescription: "Суммативное оценивание за раздел", body: "Задание", topics: "Темы или комментарий", optional: "Необязательно",
    hint: "Метка СОР появится у урока автоматически.", placeholder: "Темы для повторения, раздел или страницы…",
  };
}

export function homeworkBody(row: Pick<ClassHomework, "body" | "kind">, locale: Locale) {
  return homeworkKind(row) === "sor" && /^(сор|sor|бжб)$/iu.test(row.body.trim())
    ? homeworkKindCopy(locale).sorDescription : row.body;
}
