import type { Locale } from "./i18n";
const copy = {
  "weeklyHint": [
    "Недельное расписание Пн–Пт.",
    "Дс–Жм апталық кестесі.",
    "Monday–Friday timetable."
  ],
  "weekdays": [
    [
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница"
    ],
    [
      "Дүйсенбі",
      "Сейсенбі",
      "Сәрсенбі",
      "Бейсенбі",
      "Жұма"
    ],
    [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday"
    ]
  ],
  "shortDays": [
    [
      "Пн",
      "Вт",
      "Ср",
      "Чт",
      "Пт"
    ],
    [
      "Дс",
      "Сс",
      "Сәр",
      "Бс",
      "Жм"
    ],
    [
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri"
    ]
  ],
  "weeklyTitle": [
    "Недельное расписание",
    "Апталық кесте",
    "Weekly timetable"
  ],
  "csvTitle": [
    "Импорт CSV / TSV",
    "CSV / TSV импорты",
    "CSV / TSV import"
  ],
  "csvHint": [
    "До 512 КиБ / 1000 строк. Названия классов и предметов должны уже существовать. Импорт обновляет совпадающие слоты; пропущенные строки не удаляются. Пересечения отклоняются целиком.",
    "512 КиБ / 1000 жолға дейін. Сынып пен пән атаулары базада болуы керек. Сәйкес слоттар жаңарады; файлда жоқ жолдар жойылмайды. Қайшылық болса, импорт толығымен қабылданбайды.",
    "Up to 512 KiB / 1000 rows. Class and subject names must already exist. Matching slots are updated; omitted rows are not deleted. Overlaps reject the entire import."
  ],
  "template": [
    "Скачать шаблон CSV",
    "CSV үлгісін жүктеу",
    "Download CSV template"
  ],
  "paste": [
    "Вставьте CSV или TSV из таблицы",
    "Кестеден CSV не TSV қойыңыз",
    "Paste CSV or TSV from a spreadsheet"
  ],
  "csvFile": [
    "Файл CSV / TSV",
    "CSV / TSV файлы",
    "CSV / TSV file"
  ],
  "preview": [
    "Проверить и показать предпросмотр",
    "Тексеру және алдын ала қарау",
    "Validate and preview"
  ],
  "confirm": [
    "Все строки проверены; разрешение на эти данные получено.",
    "Барлық жол тексерілді; деректерге рұқсат алынды.",
    "All rows reviewed; permission for these data obtained."
  ],
  "import": [
    "Импортировать",
    "Импорттау",
    "Import"
  ],
  "row": [
    "Строка",
    "Жол",
    "Row"
  ],
  "format": [
    "Некорректные заголовки, кавычки или число столбцов.",
    "Тақырыптар, тырнақшалар не баған саны қате.",
    "Invalid headers, quoting or column count."
  ],
  "limit": [
    "Нужны 1–1000 строк, не более 512 КиБ.",
    "1–1000 жол, 512 КиБ-тан аспауы керек.",
    "Provide 1–1000 rows, at most 512 KiB."
  ],
  "class": [
    "Класс не найден или неоднозначен.",
    "Сынып табылмады не атауы бірегей емес.",
    "Class is unknown or ambiguous."
  ],
  "subject": [
    "Предмет не найден или неоднозначен.",
    "Пән табылмады не атауы бірегей емес.",
    "Subject is unknown or ambiguous."
  ],
  "weekday": [
    "Укажите день Пн–Пт / Дс–Жм / Mon–Fri.",
    "Дс–Жм / Пн–Пт / Mon–Fri күнін көрсетіңіз.",
    "Use a Mon–Fri / Пн–Пт / Дс–Жм weekday."
  ],
  "values": [
    "Проверьте номера уроков 1–20, время ЧЧ:ММ, даты и длину текста.",
    "1–20 сабақ нөмірін, СС:ММ уақытын, күндер мен мәтін ұзындығын тексеріңіз.",
    "Check lesson numbers 1–20, HH:MM times, dates and text length."
  ],
  "conflict": [
    "Повтор или пересечение слотов.",
    "Қайталанатын не қиылысатын слоттар.",
    "Duplicate or overlapping slots."
  ],
  "importError": [
    "Импорт не подтверждён. Проверьте существующие слоты и миграцию. Обновите данные перед повтором: при потере ответа операция могла завершиться.",
    "Импорт расталмады. Бар слоттар мен миграцияны тексеріңіз. Қайталамас бұрын жаңартыңыз: жауап жоғалса, операция аяқталған болуы мүмкін.",
    "Import not confirmed. Check existing slots and migration. Refresh before retrying: a lost response may follow a committed operation."
  ],
  "importSaved": [
    "Расписание сохранено. Пропущенные слоты не удалены.",
    "Кесте сақталды. Файлда жоқ слоттар жойылмады.",
    "Timetable saved. Omitted slots were not deleted."
  ],
  "bookTitle": [
    "Название",
    "Атауы",
    "Title"
  ],
  "author": [
    "Автор",
    "Автор",
    "Author"
  ],
  "publisher": [
    "Издатель",
    "Баспа",
    "Publisher"
  ],
  "year": [
    "Год издания",
    "Шыққан жылы",
    "Publication year"
  ],
  "language": [
    "Язык материала",
    "Материал тілі",
    "Material language"
  ],
  "pages": [
    "Число страниц (необязательно)",
    "Бет саны (міндетті емес)",
    "Page count (optional)"
  ],
  "publication": [
    "Публикация",
    "Жариялау",
    "Publication"
  ],
  "draft": [
    "Черновик",
    "Жоба",
    "Draft"
  ],
  "published": [
    "Опубликован",
    "Жарияланған",
    "Published"
  ],
  "archived": [
    "Архив",
    "Мұрағат",
    "Archived"
  ],
  "pdf": [
    "PDF-файл",
    "PDF файлы",
    "PDF file"
  ],
  "save": [
    "Сохранить материал",
    "Материалды сақтау",
    "Save material"
  ],
  "uploading": [
    "Сохранение и загрузка… Не закрывайте страницу.",
    "Сақтау және жүктеу… Бетті жаппаңыз.",
    "Saving and uploading… Keep this page open."
  ],
  "limits": [
    "Supabase Free: 1 ГБ Storage; PDF до 50 МБ (52 428 800 байт). Большой файл сожмите внешним инструментом. Остаток квоты здесь не измеряется.",
    "Supabase Free: 1 ГБ Storage; PDF 50 МБ-қа (52 428 800 байт) дейін. Үлкен файлды сыртқы құралмен сығыңыз. Қалған квота мұнда өлшенбейді.",
    "Supabase Free: 1 GB Storage; PDF up to 50 MB (52,428,800 bytes). Compress larger files externally. Remaining quota is not measured here."
  ],
  "replace": [
    "Подтверждаю замену файла. На время загрузки материал станет черновиком; старая версия не сохраняется.",
    "Файлды ауыстыруды растаймын. Жүктеу кезінде материал жобаға өтеді; ескі нұсқа сақталмайды.",
    "I confirm file replacement. The material becomes a draft during upload; the old version is not retained."
  ],
  "pdfLarge": [
    "PDF больше 50 МБ. Сожмите его внешним инструментом до загрузки.",
    "PDF 50 МБ-тан үлкен. Жүктемес бұрын сыртқы құралмен сығыңыз.",
    "PDF exceeds 50 MB. Compress it externally before uploading."
  ],
  "pdfInvalid": [
    "Выберите непустой .pdf с содержимым PDF.",
    "PDF мазмұны бар бос емес .pdf таңдаңыз.",
    "Choose a non-empty .pdf containing PDF data."
  ],
  "bookInvalid": [
    "Проверьте поля материала и подтверждение замены.",
    "Материал өрістері мен ауыстыру растауын тексеріңіз.",
    "Check material fields and replacement confirmation."
  ],
  "bookError": [
    "Сохранение не подтверждено. Обновите запись перед повтором; проверьте сессию администратора и миграцию.",
    "Сақтау расталмады. Қайталамас бұрын жазбаны жаңартып, әкімші сессиясы мен миграцияны тексеріңіз.",
    "Save not confirmed. Refresh the record before retrying; check the administrator session and migration."
  ],
  "uploadError": [
    "Загрузка не подтверждена. Материал оставлен черновиком. Проверьте соединение/квоту и повторите для этой же записи с подтверждением замены.",
    "Жүктеу расталмады. Материал жоба күйінде қалды. Байланыс/квотаны тексеріп, осы жазбаға ауыстыруды растап қайталаңыз.",
    "Upload not confirmed. The material remains a draft. Check connection/quota and retry this same record with replacement confirmation."
  ],
  "bookSaved": [
    "Материал сохранён.",
    "Материал сақталды.",
    "Material saved."
  ],
  "fileMissing": [
    "Файл не найден или не соответствует ограничениям PDF. Материал не опубликован.",
    "Файл табылмады не PDF шектеулеріне сай емес. Материал жарияланбады.",
    "File missing or outside PDF limits. Material was not published."
  ],
  "metadataHint": [
    "Без выбора нового файла сохраняются только метаданные. Новые файлы используют books/<id>.pdf в приватном Storage.",
    "Жаңа файл таңдалмаса, тек метадеректер сақталады. Жаңа файлдар жеке Storage ішіндегі books/<id>.pdf жолын қолданады.",
    "Without a new file, only metadata is saved. New files use books/<id>.pdf in private Storage."
  ],
  "catalogNames": [
    "Доступные названия классов и предметов",
    "Қолжетімді сынып пен пән атаулары",
    "Available class and subject names"
  ],
  "scheduleLimit": [
    "Расписание превышает безопасный лимит загрузки. Обратитесь к оператору.",
    "Кесте қауіпсіз жүктеу шегінен асады. Операторға хабарласыңыз.",
    "Timetable exceeds the safe loading limit. Contact the operator."
  ]
} as const;
export function phase4Copy(locale: Locale) {
 const index = locale === "kk" ? 1 : locale === "en" ? 2 : 0;
 return Object.fromEntries(Object.entries(copy).map(([key, values]) => [key, values[index]])) as { [K in keyof typeof copy]: (typeof copy)[K][number] };
}
