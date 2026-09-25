import type { SubjectRow } from "./database.types";
export const locales = ["ru", "kk", "en"] as const;
export type Locale = typeof locales[number];
export const LOCALE_COOKIE = "nis-locale";
export function parseLocale(value: unknown): Locale { return value === "kk" || value === "en" ? value : "ru"; }
const translations = {
  importTitle: ["Ручной импорт расписания","Кестені қолмен импорттау","Manual timetable import"],
  importHint: ["Разрешённый JSON версии 1: до 256 КиБ и 500 уроков. Проверьте все строки. Импорт добавляет или обновляет слоты, но не удаляет пропущенные уроки. Формат описан в docs/schedule-source-research.md.","Рұқсатты 1-нұсқалы JSON: 256 КиБ және 500 сабаққа дейін. Барлық жолды тексеріңіз. Импорт слоттарды қосады не жаңартады, файлда жоқ сабақтарды жоймайды. Формат: docs/schedule-source-research.md.","Authorised version 1 JSON: up to 256 KiB and 500 lessons. Review all rows. Import adds or updates slots; omitted lessons are not deleted. Format: docs/schedule-source-research.md."],
  importFile: ["JSON-файл расписания","Кестенің JSON файлы","Timetable JSON file"],
  importPreview: ["Предпросмотр импорта","Импортты алдын ала қарау","Import preview"],
  importConfirm: ["У меня есть разрешение на использование этих данных; даты, классы и предметы проверены.","Бұл деректерді қолдануға рұқсатым бар; күндер, сыныптар және пәндер тексерілді.","I have permission to use these data and have verified dates, classes and subjects."],
  importSubmit: ["Импортировать проверенные уроки","Тексерілген сабақтарды импорттау","Import reviewed lessons"],
  importIds: ["Идентификаторы классов и предметов","Сыныптар мен пәндер идентификаторлары","Class and subject identifiers"],
  importInvalid: ["Проверьте формат, размер, уникальность слотов, существующие классы/предметы и подтверждение разрешения.","Форматты, көлемді, слоттардың бірегейлігін, бар сыныптар/пәндерді және рұқсатты тексеріңіз.","Check format, size, unique slots, existing classes/subjects and permission confirmation."],
  importError: ["Не удалось подтвердить импорт. Обновите расписание перед повтором; проверьте связи, права и миграцию. Импорт не удаляет пропущенные уроки.","Импортты растау мүмкін болмады. Қайталамас бұрын кестені жаңартыңыз; байланыстарды, құқықтарды және миграцияны тексеріңіз. Импорт файлда жоқ сабақтарды жоймайды.","Could not confirm import. Refresh the timetable before retrying; check references, permissions and the migration. Import never deletes omitted lessons."],
  importSaved: ["Уроки импортированы. Пропущенные в файле уроки не удалены.","Сабақтар импортталды. Файлда жоқ сабақтар жойылмады.","Lessons imported. Lessons omitted from the file were not deleted."],
  adminSession: ["Требуется активная сессия администратора.","Белсенді әкімші сессиясы қажет.","An active administrator session is required."],
  teacher: ["Учитель","Мұғалім","Teacher"],
  lesson: ["Урок","Сабақ","Lesson"],
  avatarWait: ["Аватар недавно обновлён. Повторите замену через {seconds} сек.", "Аватар жақында жаңартылды. {seconds} секундтан кейін ауыстырыңыз.", "Avatar recently updated. Try replacing it again in {seconds} seconds."],
  unavailableFilter: ["Недоступный фильтр", "Қолжетімсіз сүзгі", "Unavailable filter"],
  catalogLimitHint: ["Поиск работает только в загруженной части каталога. Если материала нет, обратитесь к оператору.", "Іздеу каталогтың жүктелген бөлігінде ғана жүреді. Материал жоқ болса, операторға хабарласыңыз.", "Search covers only this loaded subset. Contact the operator if a material is missing."],
  "avatarFile": [
    "Файл аватара",
    "Аватар файлы",
    "Avatar file"
  ],
  "avatarInvalid": [
    "Выберите корректное JPEG, PNG или WebP до 2 МБ и 16 млн пикселей, без анимации.",
    "Анимациясыз, 2 МБ және 16 млн пиксельден аспайтын JPEG, PNG немесе WebP таңдаңыз.",
    "Choose a valid, non-animated JPEG, PNG or WebP up to 2 MiB and 16 million pixels."
  ],
  "avatarUploadError": [
    "Загрузка не удалась. Повторная замена доступна через 60 секунд. Если ошибка сохраняется, проверьте подключение и миграцию аватаров.",
    "Жүктеу сәтсіз аяқталды. Қайта ауыстыру 60 секундтан кейін қолжетімді. Байланыс пен аватар миграциясын тексеріңіз.",
    "Upload failed. Replacements require a 60-second interval. If it persists, check the connection and avatar migration."
  ],
  "avatarPartial": [
    "Файл загружен, но профиль не обновлён. Обновите страницу и повторите позже.",
    "Файл жүктелді, бірақ профиль жаңартылмады. Бетті жаңартып, кейін қайталаңыз.",
    "The file uploaded, but the profile could not be updated. Refresh and try again later."
  ],
  "topDuplicate": [
    "Этот предмет уже выбран.",
    "Бұл пән таңдалған.",
    "This subject is already selected."
  ],
  "consentTerms": [
    "условия использования",
    "пайдалану шарттарын",
    "the terms of use"
  ],
  "consentPrivacy": [
    "политикой конфиденциальности",
    "құпиялық саясатымен",
    "the privacy policy"
  ],
  "home": [
    "Главная",
    "Басты бет",
    "Home"
  ],
  "library": [
    "Библиотека",
    "Кітапхана",
    "Library"
  ],
  "schedule": [
    "Расписание",
    "Сабақ кестесі",
    "Timetable"
  ],
  "profile": [
    "Профиль",
    "Профиль",
    "Profile"
  ],
  "admin": [
    "Управление",
    "Басқару",
    "Manage"
  ],
  "login": [
    "Войти",
    "Кіру",
    "Sign in"
  ],
  "logout": [
    "Выйти",
    "Шығу",
    "Sign out"
  ],
  "signup": [
    "Создать аккаунт",
    "Тіркелу",
    "Create account"
  ],
  "privacy": [
    "Конфиденциальность",
    "Құпиялық",
    "Privacy"
  ],
  "terms": [
    "Условия",
    "Шарттар",
    "Terms"
  ],
  "skip": [
    "Перейти к содержимому",
    "Мазмұнға өту",
    "Skip to content"
  ],
  "mainNav": [
    "Основная навигация",
    "Негізгі мәзір",
    "Main navigation"
  ],
  "checking": [
    "Проверка входа…",
    "Кіруді тексеру…",
    "Checking session…"
  ],
  "theme": [
    "Тема",
    "Тақырып",
    "Theme"
  ],
  "welcomeTitle": [
    "Привет.",
    "Сәлем.",
    "Hello."
  ],
  "welcomeSubtitle": [
    "Твой путь в NIS Hub начинается здесь.",
    "NIS Hub-тағы жолың осы жерден басталады.",
    "A brighter learning journey starts here."
  ],
  "launchHub": [
    "Открыть NIS Hub",
    "NIS Hub ашу",
    "Launch NIS Hub"
  ],
  "pauseMotion": [
    "Приостановить анимации",
    "Анимацияларды кідірту",
    "Pause animations"
  ],
  "welcomePrivacy": [
    "Политика конфиденциальности",
    "Құпиялық саясаты",
    "Privacy Policy"
  ],
  "welcomeTerms": [
    "Условия использования",
    "Пайдалану шарттары",
    "Terms of Use"
  ],
  "resumeMotion": [
    "Продолжить анимации",
    "Анимацияларды жалғастыру",
    "Resume animations"
  ],
  "authHeroPrefix": [
    "Одно пространство для ",
    "Бір кеңістік: ",
    "One space for "
  ],
  "authHeroLearning": [
    "учёбы",
    "оқу",
    "learning"
  ],
  "authHeroPlanning": [
    "планирования",
    "жоспарлау",
    "planning"
  ],
  "authHeroAnd": [
    " и ",
    " және ",
    ", and "
  ],
  "authHeroGrowth": [
    "роста",
    "өсу",
    "growth"
  ],
  "authHeroSuffix": [
    ".",
    ".",
    "."
  ],
  "light": [
    "Светлая",
    "Ашық",
    "Light"
  ],
  "dark": [
    "Тёмная",
    "Күңгірт",
    "Dark"
  ],
  "locale": [
    "Язык интерфейса",
    "Интерфейс тілі",
    "Interface language"
  ],
  "localeError": [
    "Не удалось сохранить язык.",
    "Тілді сақтау мүмкін болмады.",
    "Could not save language."
  ],
  "pending": [
    "Обработка…",
    "Өңделуде…",
    "Processing…"
  ],
  "loading": [
    "Загрузка…",
    "Жүктелуде…",
    "Loading…"
  ],
  "retry": [
    "Повторить",
    "Қайталау",
    "Retry"
  ],
  "backHome": [
    "На главную",
    "Басты бетке",
    "Go home"
  ],
  "backLibrary": [
    "В библиотеку",
    "Кітапханаға",
    "Go to library"
  ],
  "notFound": [
    "Страница не найдена",
    "Бет табылмады",
    "Page not found"
  ],
  "notFoundHint": [
    "Материал отсутствует, снят с публикации или недоступен этому аккаунту.",
    "Материал жоқ, жарияланымнан алынған немесе бұл аккаунтқа қолжетімсіз.",
    "The material is missing, unpublished or unavailable to this account."
  ],
  "pageError": [
    "Не удалось загрузить страницу",
    "Бетті жүктеу мүмкін болмады",
    "Could not load the page"
  ],
  "pageErrorHint": [
    "Проверьте подключение и повторите попытку. Если ошибка повторяется, обратитесь к владельцу проекта.",
    "Қосылымды тексеріп, қайталаңыз. Қате қайталанса, жоба иесіне хабарласыңыз.",
    "Check your connection and try again. Contact the project owner if the error persists."
  ],
  "learningSpace": [
    "Учебное пространство",
    "Оқу кеңістігі",
    "Learning space"
  ],
  "homeHint": [
    "Библиотека материалов, расписание вашего класса и сохранённые страницы.",
    "Оқу материалдары, сынып кестесі және сақталған беттер.",
    "Learning materials, your class timetable and saved pages."
  ],
  "afterLogin": [
    "Ваши материалы после входа",
    "Материалдар кіруден кейін қолжетімді",
    "Your materials after sign-in"
  ],
  "afterLoginHint": [
    "Укажите класс в профиле, чтобы быстро открыть его расписание и учебные материалы.",
    "Кесте мен оқу материалдарын жылдам ашу үшін профильде сыныбыңызды таңдаңыз.",
    "Choose your class in your profile to quickly find its timetable and materials."
  ],
  "preparing": [
    "Подготовка к тестированию",
    "Сынаққа дайындық",
    "Preparing for testing"
  ],
  "notConfigured": [
    "Подключение к аккаунтам и библиотеке ещё не настроено.",
    "Аккаунттар мен кітапханаға қосылым әлі бапталмаған.",
    "Accounts and library access have not been configured yet."
  ],
  "setup": [
    "Настройка проекта",
    "Жобаны баптау",
    "Project setup"
  ],
  "yourSpace": [
    "Ваше пространство",
    "Сіздің кеңістігіңіз",
    "Your space"
  ],
  "hello": [
    "Здравствуйте, ",
    "Сәлеметсіз бе, ",
    "Hello, "
  ],
  "yourDay": [
    "Ваш учебный день",
    "Сіздің оқу күніңіз",
    "Your school day"
  ],
  "today": [
    "Сегодня",
    "Бүгін",
    "Today"
  ],
  "noToday": [
    "На сегодня занятий пока нет.",
    "Бүгінгі сабақтар әлі енгізілмеген.",
    "No lessons have been added for today."
  ],
  "chooseProfileClass": [
    "Выберите класс в профиле.",
    "Профильде сыныбыңызды таңдаңыз.",
    "Choose your class in your profile."
  ],
  "allSchedule": [
    "Всё расписание",
    "Толық кесте",
    "Full timetable"
  ],
  "continueReading": [
    "Продолжить чтение",
    "Оқуды жалғастыру",
    "Continue reading"
  ],
  "openLibrary": [
    "Открыть библиотеку",
    "Кітапхананы ашу",
    "Open library"
  ],
  "materials": [
    "Материалы",
    "Материалдар",
    "Materials"
  ],
  "libraryHint": [
    "Выберите класс и предмет или найдите книгу по названию.",
    "Сынып пен пәнді таңдаңыз немесе кітапты атауы бойынша іздеңіз.",
    "Choose a class and subject or search by book title."
  ],
  "title": [
    "Название",
    "Атауы",
    "Title"
  ],
  "class": [
    "Класс",
    "Сынып",
    "Class"
  ],
  "subject": [
    "Предмет",
    "Пән",
    "Subject"
  ],
  "allClasses": [
    "Все классы",
    "Барлық сыныптар",
    "All classes"
  ],
  "allSubjects": [
    "Все предметы",
    "Барлық пәндер",
    "All subjects"
  ],
  "resetFilters": [
    "Сбросить фильтры",
    "Сүзгілерді тазарту",
    "Reset filters"
  ],
  "noMaterials": [
    "Материалы не найдены",
    "Материалдар табылмады",
    "No materials found"
  ],
  "noMaterialsHint": [
    "Измените фильтры или загляните позже. Здесь появятся опубликованные администратором материалы школьной коллекции.",
    "Сүзгілерді өзгертіңіз немесе кейінірек кіріңіз. Мұнда әкімші жариялаған мектеп жинағының материалдары көрсетіледі.",
    "Change the filters or check back later. Materials from the school collection appear here after administrator publication."
  ],
  "openMaterial": [
    "Открыть материал",
    "Материалды ашу",
    "Open material"
  ],
  "results": [
    "Найдено",
    "Табылды",
    "Results"
  ],
  "catalogLimit": [
    "Достигнут предел загрузки каталога. Показана только загруженная часть; для полного каталога обратитесь к администратору.",
    "Каталогты жүктеу шегіне жетті. Тек жүктелген бөлігі көрсетілген; толық каталог үшін әкімшіге хабарласыңыз.",
    "The catalog loading limit was reached. Only loaded items are shown; contact the administrator for the full catalog."
  ],
  "onlyYou": [
    "Только для вас",
    "Тек сіз үшін",
    "Only for you"
  ],
  "profileHint": [
    "Ваш класс и любимые предметы. Имя используется для личных сообщений.",
    "Сіздің сыныбыңыз бен сүйікті пәндеріңіз. Есім жеке хабарламалар үшін қолданылады.",
    "Your class and favourite subjects. Your name is used for direct messages."
  ],
  "displayName": [
    "Отображаемое имя",
    "Көрсетілетін есім",
    "Display name"
  ],
  "saveProfile": [
    "Сохранить профиль",
    "Профильді сақтау",
    "Save profile"
  ],
  "topHint": [
    "До четырёх разных предметов в выбранном порядке.",
    "Таңдалған ретпен төртке дейін әртүрлі пән.",
    "Up to four different subjects in your chosen order."
  ],
  "notSelected": [
    "Не выбран",
    "Таңдалмаған",
    "Not selected"
  ],
  "duplicateSubject": [
    "Этот предмет уже выбран в другом слоте.",
    "Бұл пән басқа орында таңдалған.",
    "This subject is already selected in another slot."
  ],
  "bookmarks": [
    "Закладки",
    "Бетбелгілер",
    "Bookmarks"
  ],
  "noBookmarks": [
    "Закладок пока нет.",
    "Бетбелгілер әлі жоқ.",
    "No bookmarks yet."
  ],
  "noProgress": [
    "Откройте книгу, чтобы продолжить чтение здесь.",
    "Оқуды осында жалғастыру үшін кітапты ашыңыз.",
    "Open a book to continue reading here."
  ],
  "unavailableBook": [
    "Материал недоступен",
    "Материал қолжетімсіз",
    "Material unavailable"
  ],
  "page": [
    "Страница",
    "Бет",
    "Page"
  ],
  "remove": [
    "Удалить",
    "Жою",
    "Remove"
  ],
  "removing": [
    "Удаление…",
    "Жойылуда…",
    "Removing…"
  ],
  "account": [
    "Аккаунт",
    "Аккаунт",
    "Account"
  ],
  "loginHint": [
    "Откройте библиотеку и свои сохранённые страницы.",
    "Кітапхана мен сақталған беттеріңізді ашыңыз.",
    "Access the library and your saved pages."
  ],
  "signupHint": [
    "Создайте личное учебное пространство.",
    "Жеке оқу кеңістігіңізді құрыңыз.",
    "Create your personal learning space."
  ],
  "email": [
    "Email",
    "Email",
    "Email"
  ],
  "password": [
    "Пароль",
    "Құпиясөз",
    "Password"
  ],
  "passwordHint": [
    "Минимум 8 символов.",
    "Кемінде 8 таңба.",
    "At least 8 characters."
  ],
  "accept": [
    "Я принимаю",
    "Мен қабылдаймын:",
    "I accept the"
  ],
  "andPrivacy": [
    "и ознакомился с",
    "және таныстым:",
    "and have read the"
  ],
  "noAccount": [
    "Нет аккаунта?",
    "Аккаунтыңыз жоқ па?",
    "No account?"
  ],
  "hasAccount": [
    "Уже есть аккаунт?",
    "Аккаунтыңыз бар ма?",
    "Already have an account?"
  ],
  "confirmFailed": [
    "Ссылка подтверждения недействительна или истекла. Повторите регистрацию или обратитесь к администратору.",
    "Растау сілтемесі жарамсыз немесе мерзімі өткен. Қайта тіркеліңіз немесе әкімшіге хабарласыңыз.",
    "The confirmation link is invalid or expired. Register again or contact the administrator."
  ],
  "authNotConfigured": [
    "Вход пока недоступен: владелец проекта ещё не подключил аккаунты.",
    "Кіру әзірге қолжетімсіз: жоба иесі аккаунттарды әлі қоспаған.",
    "Sign-in is unavailable: accounts have not been configured yet."
  ],
  "schoolDay": [
    "Учебный день",
    "Оқу күні",
    "School day"
  ],
  "scheduleHint": [
    "Занятия, добавленные администратором для вашего класса.",
    "Әкімші сіздің сыныбыңыз үшін енгізген сабақтар.",
    "Lessons added by the administrator for your class."
  ],
  "date": [
    "Дата",
    "Күні",
    "Date"
  ],
  "show": [
    "Показать",
    "Көрсету",
    "Show"
  ],
  "invalidDate": [
    "Дата в ссылке некорректна. Показана сегодняшняя дата.",
    "Сілтемедегі күн жарамсыз. Бүгінгі күн көрсетілді.",
    "The date in the link is invalid. Showing today instead."
  ],
  "room": [
    "Кабинет",
    "Кабинет",
    "Room"
  ],
  "noLessons": [
    "Занятий пока нет",
    "Сабақтар әлі жоқ",
    "No lessons yet"
  ],
  "chooseClass": [
    "Выберите класс",
    "Сыныпты таңдаңыз",
    "Choose a class"
  ],
  "noLessonsHint": [
    "На выбранную дату расписание ещё не добавлено.",
    "Таңдалған күннің кестесі әлі енгізілмеген.",
    "No timetable has been added for the selected date."
  ],
  "chooseClassHint": [
    "После выбора класса здесь появится его расписание.",
    "Сыныпты таңдағаннан кейін оның кестесі көрсетіледі.",
    "Choose a class to see its timetable."
  ],
  "material": [
    "Учебный материал",
    "Оқу материалы",
    "Learning material"
  ],
  "pdfHint": [
    "PDF для чтения в личном кабинете.",
    "Жеке кабинетте оқуға арналған PDF.",
    "PDF for reading in your account."
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
    "Басылған жылы",
    "Publication year"
  ],
  "bookLanguage": [
    "Язык",
    "Тіл",
    "Language"
  ],
  "pages": [
    "Страниц",
    "Беттер саны",
    "Pages"
  ],
  "readPdf": [
    "Читать PDF",
    "PDF оқу",
    "Read PDF"
  ],
  "aboutMaterial": [
    "О материале",
    "Материал туралы",
    "About this material"
  ],
  "reader": [
    "Чтение PDF",
    "PDF оқу",
    "PDF reader"
  ],
  "previous": [
    "Назад",
    "Артқа",
    "Previous"
  ],
  "next": [
    "Далее",
    "Келесі",
    "Next"
  ],
  "pageNumber": [
    "Номер страницы",
    "Бет нөмірі",
    "Page number"
  ],
  "zoom": [
    "Масштаб",
    "Масштаб",
    "Zoom"
  ],
  "saving": [
    "Сохранение…",
    "Сақталуда…",
    "Saving…"
  ],
  "addBookmark": [
    "В закладки",
    "Бетбелгі қосу",
    "Add bookmark"
  ],
  "removeBookmark": [
    "Удалить закладку",
    "Бетбелгіні жою",
    "Remove bookmark"
  ],
  "loadingPage": [
    "Загружаем страницу…",
    "Бет жүктелуде…",
    "Loading page…"
  ],
  "of": [
    "из",
    "/",
    "of"
  ],
  "pageText": [
    "Текст страницы",
    "Бет мәтіні",
    "Page text"
  ],
  "noText": [
    "В этом PDF нет текстового слоя. Для доступности нужен документ с распознанным текстом.",
    "Бұл PDF-те мәтін қабаты жоқ. Қолжетімділік үшін мәтіні танылған құжат қажет.",
    "This PDF has no text layer. An OCR document is needed for accessible text."
  ],
  "bookBookmarks": [
    "Закладки этой книги",
    "Осы кітаптың бетбелгілері",
    "Bookmarks in this book"
  ],
  "loadPdfError": [
    "Не удалось открыть PDF. Проверьте вход и повторите загрузку.",
    "PDF ашылмады. Кіруді тексеріп, қайта жүктеңіз.",
    "Could not open the PDF. Check your session and retry."
  ],
  "renderPdfError": [
    "Не удалось отобразить страницу. Попробуйте загрузить PDF снова.",
    "Бетті көрсету мүмкін болмады. PDF-ті қайта жүктеңіз.",
    "Could not render this page. Reload the PDF and try again."
  ],
  "textPdfError": [
    "Не удалось извлечь текст этой страницы. PDF доступен для просмотра.",
    "Бет мәтіні алынбады. PDF-ті көруге болады.",
    "Could not extract this page's text. The PDF is still viewable."
  ],
  "reloadPdf": [
    "Повторить загрузку",
    "Қайта жүктеу",
    "Reload PDF"
  ],
  "invalidInput": [
    "Проверьте введённые данные.",
    "Енгізілген деректерді тексеріңіз.",
    "Check the values you entered."
  ],
  "saveError": [
    "Не удалось сохранить. Проверьте подключение и повторите попытку.",
    "Сақтау мүмкін болмады. Қосылымды тексеріп, қайталаңыз.",
    "Could not save. Check your connection and try again."
  ],
  "sessionError": [
    "Войдите в аккаунт и повторите действие.",
    "Аккаунтқа кіріп, әрекетті қайталаңыз.",
    "Sign in and try again."
  ],
  "profileSaved": [
    "Профиль сохранён.",
    "Профиль сақталды.",
    "Profile saved."
  ],
  "positionSaved": [
    "Позиция сохранена.",
    "Оқу орны сақталды.",
    "Reading position saved."
  ],
  "bookmarkSaved": [
    "Закладка сохранена.",
    "Бетбелгі сақталды.",
    "Bookmark saved."
  ],
  "bookmarkRemoved": [
    "Закладка удалена.",
    "Бетбелгі жойылды.",
    "Bookmark removed."
  ],
  "termsRequired": [
    "Ознакомьтесь с условиями и политикой конфиденциальности.",
    "Шарттармен және құпиялық саясатымен танысыңыз.",
    "Read the terms and privacy notice."
  ],
  "tooManyAttempts": [
    "Слишком много попыток. Подождите и попробуйте снова.",
    "Әрекет тым көп. Күтіп, қайталаңыз.",
    "Too many attempts. Wait and try again."
  ],
  "confirmEmail": [
    "Подтвердите email по ссылке из письма.",
    "Хаттағы сілтеме арқылы email-ді растаңыз.",
    "Confirm your email using the link in the message."
  ],
  "loginError": [
    "Не удалось войти. Проверьте email и пароль.",
    "Кіру мүмкін болмады. Email мен құпиясөзді тексеріңіз.",
    "Could not sign in. Check your email and password."
  ],
  "signupError": [
    "Не удалось зарегистрироваться. Проверьте email и требования к паролю.",
    "Тіркелу мүмкін болмады. Email мен құпиясөз талаптарын тексеріңіз.",
    "Could not register. Check your email and password requirements."
  ],
  "checkEmail": [
    "Проверьте почту: если регистрация доступна, вы получите письмо для подтверждения email.",
    "Поштаңызды тексеріңіз: тіркелу қолжетімді болса, email растау хатын аласыз.",
    "Check your inbox: if registration is available, you will receive an email confirmation."
  ],
  "logoutError": [
    "Не удалось выйти. Повторите попытку.",
    "Шығу мүмкін болмады. Қайталаңыз.",
    "Could not sign out. Try again."
  ],
  "avatar": [
    "Аватар",
    "Аватар",
    "Avatar"
  ],
  "avatarHint": [
    "JPEG, PNG или WebP до 2 МБ, без анимации. Квадратный WebP 256×256 заменяет прежний файл. Между заменами — 60 секунд.",
    "Анимациясыз, 2 МБ-қа дейінгі JPEG, PNG немесе WebP. 256×256 WebP ескі файлды ауыстырады. Ауыстыру аралығы — 60 секунд.",
    "Non-animated JPEG, PNG or WebP up to 2 MiB. A 256×256 WebP replaces the previous file. Wait 60 seconds between replacements."
  ],
  "avatarUpload": [
    "Сохранить аватар",
    "Аватарды сақтау",
    "Save avatar"
  ],
  "avatarSaved": [
    "Аватар сохранён.",
    "Аватар сақталды.",
    "Avatar saved."
  ],
  "avatarCooldown": [
    "Замена доступна раз в минуту. Если минута прошла, проверьте подключение и миграцию аватаров.",
    "Минутына бір рет ауыстыруға болады. Бір минут өтсе, қосылымды және аватар миграциясын тексеріңіз.",
    "Replacement is available once per minute. If a minute has passed, check the connection and avatar migration."
  ],
  "avatarUnavailable": [
    "Аватар недоступен",
    "Аватар қолжетімсіз",
    "Avatar unavailable"
  ],
  "forbidden": [
    "Доступ ограничен",
    "Кіру шектелген",
    "Access restricted"
  ],
  "adminRequired": [
    "Нужна роль администратора",
    "Әкімші рөлі қажет",
    "Administrator role required"
  ],
  "beta": [
    "Бета-версия",
    "Бета-нұсқа",
    "Beta"
  ],
  "forbiddenHint": [
    "Этот аккаунт не может управлять учебными материалами и расписанием.",
    "Бұл аккаунт оқу материалдары мен кестені басқара алмайды.",
    "This account cannot manage materials or timetables."
  ]
} satisfies Record<string, readonly [string, string, string]>;
export type MessageKey = keyof typeof translations;
export type Dictionary = Record<MessageKey, string>;
export const dictionaries = Object.fromEntries(locales.map((locale, index) => [locale, Object.fromEntries(Object.entries(translations).map(([key, values]) => [key, values[index]]))])) as Record<Locale, Dictionary>;
const knownSubjects: Record<string, [string,string,string]> = {
  "основы права": ["Основы права","Құқық негіздері","Fundamentals of Law"],
  "fundamentals of law": ["Основы права","Құқық негіздері","Fundamentals of Law"],
  "құқық негіздері": ["Основы права","Құқық негіздері","Fundamentals of Law"],
  "law": ["Основы права","Құқық негіздері","Fundamentals of Law"],
  "искусство": ["Искусство","Өнер","Art"], "өнер": ["Искусство","Өнер","Art"],
  "art": ["Искусство","Өнер","Art"], "arts": ["Искусство","Өнер","Art"],
};
export function subjectName(subject: Pick<SubjectRow, "name" | "name_ru" | "name_kz" | "name_en"> | undefined, locale: Locale): string {
  if (!subject) return "";
  const known=knownSubjects[subject.name.trim().toLocaleLowerCase()];
  if(known) return known[locale==="ru"?0:locale==="kk"?1:2];
  return (locale === "kk" ? subject.name_kz : locale === "en" ? subject.name_en : subject.name_ru ?? subject.name)?.trim() || (locale==="ru" ? subject.name : locale==="kk" ? "Пән" : "Subject");
}
