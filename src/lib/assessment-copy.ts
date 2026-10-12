import type { Locale } from "./i18n";
const copy = {
  schoolYear: [
    "Учебный год (начало)",
    "Оқу жылының басы",
    "Academic year (starting year)",
  ],
  quarter: ["Четверть", "Тоқсан", "Quarter"],
  period: [
    "Укажите учебный год и четверть. Даты СОЧ должны входить в этот учебный год.",
    "Оқу жылы мен тоқсанды көрсетіңіз. ТЖБ күндері осы оқу жылына кіруі керек.",
    "Specify academic year and quarter. Assessment dates must belong to that academic year.",
  ],
  changed: [
    "Расписание этой четверти уже изменилось. Проверьте файл ещё раз перед применением.",
    "Осы тоқсанның кестесі өзгерді. Қолданар алдында файлды қайта тексеріңіз.",
    "This quarter's schedule has changed. Preview the file again before applying it.",
  ],
  title: ["Расписание СОЧ", "ТЖБ кестесі", "Quarter assessment timetable"],
  hint: [
    "Загрузите Excel: класс или параллель, время уроков и даты в заголовках. СОЧ заменят указанные уроки во всех классах параллели только на эти даты. Остальные уроки сохранятся.",
    "Excel жүктеңіз: сынып немесе параллель, сабақ нөмірлері және бағандарда күндер. ТЖБ сол күндердегі сабақтарды параллельдің барлық сыныптарында ауыстырады. Басқа сабақтар сақталады.",
    "Upload Excel with classes or grades, lesson ranges and dates in column headers. Assessments replace the listed slots for every class in the grade on those dates. Other lessons stay in place.",
  ],
  file: ["Файл СОЧ (.xlsx)", "ТЖБ файлы (.xlsx)", "Assessment file (.xlsx)"],
  year: [
    "Год дат (если в файле не указан)",
    "Күндердің жылы (файлда көрсетілмесе)",
    "Year of dates (if missing from the file)",
  ],
  auto: [
    "Автоматически из заголовка",
    "Тақырыптан автоматты түрде",
    "Detect from workbook title",
  ],
  preview: ["Проверить файл", "Файлды тексеру", "Preview file"],
  publish: [
    "Применить расписание СОЧ",
    "ТЖБ кестесін қолдану",
    "Apply assessment timetable",
  ],
  saved: [
    "Расписание СОЧ сохранено. На указанные даты уроки заменятся автоматически.",
    "ТЖБ кестесі сақталды. Көрсетілген күндердегі сабақтар автоматты ауысады.",
    "Assessment timetable saved. Lessons will change automatically on the listed dates.",
  ],
  error: [
    "Не удалось сохранить расписание СОЧ.",
    "ТЖБ кестесі сақталмады.",
    "Could not save assessment timetable.",
  ],
  format: [
    "Не удалось прочитать .xlsx. Нужны столбцы «Класс», «Время» и даты, например «14 октября».",
    ".xlsx оқылмады. «Сынып», «Уақыт» және күндер бағандары қажет, мысалы «14 қазан».",
    "Could not read .xlsx. Expected Class, Time and date columns, such as 14 October.",
  ],
  limit: [
    "Допустим .xlsx до 2 МБ, не более 1000 строк и 10 000 записей СОЧ.",
    "2 МБ дейінгі .xlsx, ең көбі 1000 жол және 10 000 ТЖБ жазбасы.",
    "Use .xlsx up to 2 MB, at most 1,000 rows and 10,000 assessment entries.",
  ],
  date: [
    "Проверьте дату и год. Для учебного года используется осенний год в сентябре–декабре и следующий год в январе–августе.",
    "Күн мен жылды тексеріңіз. Оқу жылы үшін қыркүйек–желтоқсанда бірінші жыл, қаңтар–тамызда келесі жыл қолданылады.",
    "Check date and year. An academic year uses its first year in September–December and the next year in January–August.",
  ],
  class: [
    "Класс или параллель не найдены в справочнике.",
    "Сынып немесе параллель анықтамалықта жоқ.",
    "Class or grade not found in the catalog.",
  ],
  values: [
    "Проверьте номера уроков, название предмета и длительность СОЧ.",
    "Сабақ нөмірлерін, пәнді және ТЖБ ұзақтығын тексеріңіз.",
    "Check lesson range, subject label and assessment duration.",
  ],
  conflict: [
    "В файле пересекаются СОЧ одного класса в одну дату.",
    "Бір сыныптың бір күндегі ТЖБ сабақтары қабаттасады.",
    "Assessments overlap for the same class and date.",
  ],
  row: ["Строка", "Жол", "Row"],
  count: ["Записей СОЧ", "ТЖБ жазбалары", "Assessment entries"],
  classes: ["Классы", "Сыныптар", "Classes"],
  dates: ["Даты", "Күндер", "Dates"],
  minutes: ["мин", "мин", "min"],
  badge: ["СОЧ", "ТЖБ", "Assessment"],
  confirm: [
    "Заменить СОЧ этой четверти для перечисленных классов. Прежние даты, в том числе перенесённые, будут убраны. Другие четверти сохранятся.",
    "Көрсетілген сыныптардың осы тоқсандағы ТЖБ кестесін ауыстыру. Ескі күндер жойылады. Басқа тоқсандар сақталады.",
    "Replace this quarter's assessments for the listed classes, removing old dates including moved exams. Other quarters are preserved.",
  ],
  sample: [
    "Скачать пример Excel",
    "Excel үлгісін жүктеу",
    "Download Excel example",
  ],
  clear: [
    "Убрать СОЧ на выбранные даты",
    "Таңдалған күндердің ТЖБ жою",
    "Remove assessments on selected dates",
  ],
  cleared: [
    "СОЧ убраны. На эти даты снова действует обычное расписание.",
    "ТЖБ жойылды. Бұл күндерге әдеттегі кесте қолданылады.",
    "Assessments removed. The ordinary timetable applies again on these dates.",
  ],
  active: [
    "Загруженные даты СОЧ",
    "Жүктелген ТЖБ күндері",
    "Uploaded assessment dates",
  ],
  migration: [
    "Для импорта СОЧ нужно обновить базу данных. Обычное расписание доступно.",
    "ТЖБ импорты үшін дерекқорды жаңарту қажет. Әдеттегі кесте қолжетімді.",
    "The database needs an update to import assessments. The ordinary timetable is available.",
  ],
} as const;
export function assessmentCopy(locale: Locale) {
  const index = locale === "ru" ? 0 : locale === "kk" ? 1 : 2;
  return Object.fromEntries(
    Object.entries(copy).map(([key, value]) => [key, value[index]]),
  ) as { [K in keyof typeof copy]: string };
}
