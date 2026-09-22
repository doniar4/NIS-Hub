import type { Locale } from "./i18n";
const words = {
  welcome: ["Учебное пространство", "Оқу кеңістігі", "Your study space"],
  hello: ["Привет", "Сәлем", "Hello"],
  selected: ["Выбранный урок", "Таңдалған сабақ", "Selected lesson"],
  select: ["Выберите урок в расписании", "Кестеден сабақты таңдаңыз", "Choose a lesson in the timetable"],
  studyHint: ["Выберите учебник и диапазон страниц. AI Study использует только выбранный текст.", "Оқулық пен беттер ауқымын таңдаңыз. AI Study тек таңдалған мәтінді пайдаланады.", "Choose a textbook and page range. AI Study uses only the selected text."],
  activity: ["Недавнее чтение", "Соңғы оқылғандар", "Recent reading"],
  homework: ["Домашнее задание", "Үй тапсырмасы", "Homework"],
  homeworkFull: ["Все задания и редактирование", "Барлық тапсырмалар және өңдеу", "All homework and editing"],
  loading: ["Загрузка…", "Жүктелуде…", "Loading…"],
  loadError: ["Не удалось загрузить. Повторите попытку.", "Жүктеу мүмкін болмады. Қайталап көріңіз.", "Could not load. Please retry."],
  retry: ["Повторить", "Қайталау", "Retry"],
  details: ["Сведения о книге", "Кітап туралы", "Book information"],
  thumbnails: ["Миниатюры страниц", "Бет нобайлары", "Page thumbnails"],
  close: ["Закрыть", "Жабу", "Close"],
  openStudy: ["Открыть AI Study", "AI Study ашу", "Open AI Study"],
  guest: ["Библиотека, расписание и инструменты для учёбы — в одном месте.", "Кітапхана, кесте және оқу құралдары — бір жерде.", "Your library, timetable and study tools in one place."],
} as const;
export function designCopy(locale: Locale) {
  const i = locale === "kk" ? 1 : locale === "en" ? 2 : 0;
  return Object.fromEntries(Object.entries(words).map(([key, values]) => [key, values[i]])) as Record<keyof typeof words, string>;
}
