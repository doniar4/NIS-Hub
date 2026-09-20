import {supportLegalCopy} from "./support-legal-copy";
import type { Locale } from "./i18n";
type LegalCopy = { draft: string; intro: string; revision: string; privacyTitle: string; termsTitle: string; privacy: [string, string][]; terms: [string, string][] };
const baseLegalCopy = {
  "ru": {
    "draft": "Черновик · не юридическая консультация",
    "intro": "NIS Hub — тестовый учебный проект. Эти тексты описывают текущую реализацию, но требуют заполнения реквизитов и юридической проверки до публичного запуска.",
    "revision": "Редакция черновика: 15.09.2026. Дата вступления в силу: [УКАЗАТЬ ПОСЛЕ ПРОВЕРКИ].",
    "privacyTitle": "Политика конфиденциальности",
    "termsTitle": "Условия использования",
    "privacy": [
      [
        "Оператор и связь",
        "Оператор NIS Hub: [УКАЗАТЬ ИМЯ / ОРГАНИЗАЦИЮ И АДРЕС]. Контакт по данным, безопасности и удалению: [УКАЗАТЬ РАБОЧИЙ EMAIL]. Пока эти поля не заполнены, опубликованного канала обработки запросов нет."
      ],
      [
        "Аккаунт и профиль",
        "Supabase Auth обрабатывает email, пароль и данные сессии для регистрации и входа. В базе Supabase хранятся идентификатор аккаунта, отображаемое имя, класс, до четырёх избранных предметов (Top 4), роль, временные отметки и путь аватара. Поле описания профиля предусмотрено схемой, но сейчас не редактируется в интерфейсе."
      ],
      [
        "Аватар и чтение",
        "Аватар хранится в приватном Supabase Storage по пути <uid>/avatar.webp. Приложение преобразует изображение в WebP и удаляет метаданные; новая загрузка заменяет предыдущий файл. Для ограничения замен используется время обновления. Закладки и последняя прочитанная страница сохраняются в базе по аккаунту и книге."
      ],
      [
        "Цели и доступ",
        "Данные нужны для входа, персонального профиля, выбора класса, закладок и продолжения чтения. Правила доступа ограничивают профиль, аватар и историю их владельцем в приложении; оператор с административным доступом к инфраструктуре и поставщик сервиса могут иметь технический доступ. Опубликованные разрешённые материалы и расписание доступны вошедшим пользователям."
      ],
      [
        "Сервисы и расписание",
        "Работающий внешний сервис — Supabase: Auth, база данных и Storage. Хостинг и регион размещения: [ПОДТВЕРДИТЬ ФАКТИЧЕСКИЕ ДАННЫЕ]; Vercel не заявляется как подключённый сервис. PDF.js и шрифты Reader загружаются с сайта. Автоматической интеграции EduPage нет: администратор может внести разрешённое расписание, через CSV/TSV: класс, предмет, день недели, интервал уроков, время, даты действия и, при необходимости, учителя и кабинет. Историческое расписание по датам сохранено."
      ],
      [
        "Cookies и локальные настройки",
        "Cookies Supabase поддерживают вход и обновление сессии; их срок зависит от настройки Auth. Cookie nis-locale сохраняет язык на срок до года и передаётся серверу. Ключ nis-theme в localStorage хранит выбор Light/Dark до очистки или изменения; сам выбор темы серверу не отправляется. Поисковые фильтры библиотеки отражаются в URL, поэтому могут попасть в историю браузера и журнал запросов при открытии ссылки."
      ],
      [
        "Аналитика и технические журналы",
        "В коде NIS Hub нет рекламных и аналитических трекеров. Supabase и фактический хостинг могут обрабатывать технические журналы запросов и безопасности. Их состав и сроки оператор должен уточнить перед запуском. Не отправляйте пароли, токены или приватные подписанные ссылки в сообщения об ошибках."
      ],
      [
        "Хранение, исправление и удаление",
        "Профиль можно исправить в интерфейсе, закладки — удалить, аватар — заменить. Самообслуживания для удаления аккаунта и автоматической очистки по сроку пока нет. Запрос на получение или удаление данных нужно передать оператору через контакт выше после его заполнения. Оператор проверяет принадлежность аккаунта, удаляет аккаунт и связанные записи, отдельно удаляет аватар через Storage API и проверяет сроки журналов/резервных копий. Конкретные сроки хранения и ответа: [УСТАНОВИТЬ ДО ЗАПУСКА]."
      ],
      [
        "Совершеннолетняя аудитория",
        "Сервис предназначен для совершеннолетних пользователей (18+), как подтвердил владелец. Оператор должен обеспечить соответствующее ограничение доступа перед включением Gemini; технической проверки возраста в приложении нет. Не добавляйте лишние персональные данные или изображения других людей. Этот черновик не подтверждает юридическое соответствие."
      ],
      [
        "Gemini AI Study · beta",
        "AI Study необязателен и выключен до настройки оператором. По вашему запросу сервер отправляет Google Gemini только текст выбранных страниц, режим и язык ответа — не профиль, email, токены, подписанные URL или всю книгу. На бесплатном тарифе содержимое может использоваться Google для улучшения сервисов и проверяться людьми; не выбирайте конфиденциальные данные. Администратор один раз извлекает текст PDF по страницам в Supabase. Кэш ответа хранит владельца, вариант учебника, диапазон, режим, язык, хэш источника, ответ и время; счётчик ограничивает попытки генерации. Замена источника делает старый кэш недействительным. Оператор должен установить срок хранения и удалять кэш при запросах на удаление данных. AI может ошибаться: сверяйте выводы с цитатами и указанными страницами."
      ]
    ],
    "terms": [
      [
        "Проект и оператор",
        "NIS Hub — бесплатный тестовый учебный проект, а не заявленный официальный сервис школы или сети НИШ. Официальное одобрение школы не утверждается. Оператор: [УКАЗАТЬ ИМЯ / ОРГАНИЗАЦИЮ]. Контакт: [УКАЗАТЬ РАБОЧИЙ EMAIL]."
      ],
      [
        "Аккаунт",
        "Берегите пароль и доступ к email, не передавайте аккаунт другим и не выдавайте себя за другого человека. Доступ предназначен для совершеннолетних (18+). О подозрении на компрометацию сообщайте оператору без передачи пароля или токенов."
      ],
      [
        "Допустимое использование",
        "Используйте сайт для учебной работы в пределах предоставленного доступа. Запрещены обход авторизации и ограничений, попытки получить чужие данные, вредоносные загрузки, травля и действия, нарушающие работу сайта."
      ],
      [
        "Материалы и расписание",
        "Администратор размещает материалы только при наличии подтверждённых прав и разрешения на публикацию. Учебное использование само по себе не разрешает распространение учебника. Импорт расписания требует разрешения на соответствующие данные. Не переносите сведения об учениках или закрытые данные из EduPage."
      ],
      [
        "Аватары и личный контент",
        "Загружайте только разрешённые изображения, на которые у вас есть необходимые права. Не загружайте чужие персональные данные, оскорбительный, незаконный или вредоносный контент. При замене аватара прежний файл перезаписывается; восстановление предыдущей версии в приложении не предусмотрено."
      ],
      [
        "Защищённые файлы",
        "PDF и аватары находятся в приватном Storage; временная подписанная ссылка предоставляет доступ на ограниченный срок. Не публикуйте ссылки, токены и копии материалов без соответствующих прав. Приватность bucket не является DRM и не препятствует сохранению уже полученной копии."
      ],
      [
        "Доступность и безопасность",
        "В beta-версии возможны ошибки, перерывы, устаревшее расписание и изменения функций. Подтверждайте важные изменения расписания у школы. Оператор может ограничить доступ при злоупотреблении или угрозе безопасности через средства администрирования; отдельного механизма обжалования в приложении пока нет. Контакт и порядок рассмотрения обращений должны быть заполнены до запуска."
      ],
      [
        "Стоимость, изменения и данные",
        "Платежей и подписок нет; правила возврата не применяются к несуществующим покупкам. Будущие платные функции потребуют отдельных условий. Эти условия остаются черновиком: дата вступления в силу и порядок уведомления об изменениях ещё не утверждены. Обработка данных описана в политике конфиденциальности."
      ],
      [
        "Совершеннолетняя аудитория",
        "Сервис предназначен для совершеннолетних пользователей (18+), как подтвердил владелец. Оператор должен обеспечить соответствующее ограничение доступа перед включением Gemini; технической проверки возраста в приложении нет. Не добавляйте лишние персональные данные или изображения других людей. Этот черновик не подтверждает юридическое соответствие."
      ]
    ]
  },
  "kk": {
    "draft": "Жоба · заңгерлік кеңес емес",
    "intro": "NIS Hub — сынақтағы оқу жобасы. Бұл мәтіндер қазіргі жұмысты сипаттайды; көпшілікке іске қоспас бұрын деректемелер толтырылып, заңгер тексеруі керек.",
    "revision": "Жоба редакциясы: 15.09.2026. Күшіне ену күні: [ТЕКСЕРУДЕН КЕЙІН КӨРСЕТУ].",
    "privacyTitle": "Құпиялық саясаты",
    "termsTitle": "Пайдалану шарттары",
    "privacy": [
      [
        "Оператор және байланыс",
        "NIS Hub операторы: [АТЫ / ҰЙЫМЫ МЕН МЕКЕНЖАЙЫН КӨРСЕТУ]. Деректер, қауіпсіздік және жою сұрақтары: [ЖҰМЫС EMAIL КӨРСЕТУ]. Бұл өрістер толтырылмайынша, өтініш қабылдайтын жария байланыс арнасы жоқ."
      ],
      [
        "Аккаунт және профиль",
        "Supabase Auth тіркелу мен кіру үшін email, құпиясөз және сессия деректерін өңдейді. Supabase базасында аккаунт идентификаторы, көрсетілетін есім, сынып, төртке дейінгі таңдаулы пән (Top 4), рөл, уақыт белгілері және аватар жолы сақталады. Профиль сипаттамасы схемада бар, бірақ интерфейсте әзірше өзгертілмейді."
      ],
      [
        "Аватар және оқу",
        "Аватар жеке Supabase Storage ішінде <uid>/avatar.webp жолымен сақталады. Қолданба суретті WebP-ке айналдырып, метадеректерді алып тастайды; жаңа файл бұрынғысын ауыстырады. Ауыстыруды шектеу үшін жаңарту уақыты қолданылады. Бетбелгілер мен соңғы оқылған бет аккаунт және кітап бойынша базада сақталады."
      ],
      [
        "Мақсаты және қолжетімділік",
        "Деректер кіру, жеке профиль, сынып таңдау, бетбелгілер және оқуды жалғастыру үшін керек. Қолданбадағы ережелер профильді, аватарды және оқу тарихын иесіне ғана көрсетеді; инфрақұрылым әкімшісі мен қызмет жеткізушісінің техникалық қолжетімділігі болуы мүмкін. Жарияланған рұқсатты материалдар мен кестені кірген пайдаланушылар көреді."
      ],
      [
        "Қызметтер және кесте",
        "Қосылған сыртқы қызмет — Supabase: Auth, деректер базасы және Storage. Хостинг пен орналасу аймағы: [НАҚТЫ ДЕРЕКТЕРДІ РАСТАУ]; Vercel қосылған деп мәлімделмейді. PDF.js және Reader қаріптері сайттан жүктеледі. EduPage автоматты интеграциясы жоқ: әкімші рұқсатты CSV/TSV арқылы сынып, пән, апта күні, сабақ аралығы, уақыт, қолданылу күндері және қажет болса мұғалім мен кабинет деректерін енгізе алады. Ескі күндік кесте сақталған."
      ],
      [
        "Cookies және жергілікті баптаулар",
        "Supabase cookies кіруді және сессияны жаңартуды қолдайды; мерзімі Auth баптауына байланысты. nis-locale cookie тілді бір жылға дейін сақтап, серверге жіберіледі. localStorage ішіндегі nis-theme Light/Dark таңдауын тазартылғанша не өзгертілгенше сақтайды; тақырып таңдауы серверге жіберілмейді. Кітапхана сүзгілері URL-де болады, сондықтан сілтемені ашқанда браузер тарихы мен сұрау журналына түсуі мүмкін."
      ],
      [
        "Аналитика және техникалық журналдар",
        "NIS Hub кодында жарнама және аналитикалық трекерлер жоқ. Supabase пен нақты хостинг сұраулар және қауіпсіздік журналдарын өңдеуі мүмкін. Олардың құрамы мен сақтау мерзімін оператор іске қосар алдында анықтауы керек. Қате туралы хабарламаға құпиясөз, токен немесе жеке қолтаңбалы сілтеме қоспаңыз."
      ],
      [
        "Сақтау, түзету және жою",
        "Профильді өзгертуге, бетбелгіні жоюға және аватарды ауыстыруға болады. Аккаунтты өздігінен жою және мерзім бойынша автоматты тазарту әзірше жоқ. Деректерді алу не жою өтінішін жоғарыдағы байланыс толтырылғаннан кейін операторға жіберіңіз. Оператор аккаунт иесін тексеріп, аккаунт пен байланысқан жазбаларды жояды, аватарды Storage API арқылы бөлек өшіреді және журналдар мен резервтік көшірмелер мерзімін тексереді. Сақтау және жауап беру мерзімдері: [ІСКЕ ҚОСАР АЛДЫНДА БЕЛГІЛЕУ]."
      ],
      [
        "Кәмелетке толған аудитория",
        "Иесінің растауы бойынша сервис кәмелетке толған (18+) пайдаланушыларға арналған. Gemini іске қосылғанға дейін оператор қолжетімділікті тиісінше шектеуі керек; қолданба жасты техникалық тексермейді. Артық жеке деректер мен басқа адамдардың суреттерін қоспаңыз. Бұл жоба заң талаптарына сәйкестікті растамайды."
      ],
      [
        "Gemini AI Study · beta",
        "AI Study міндетті емес және оператор баптағанша өшірулі. Сұрауыңыз бойынша сервер Google Gemini-ге тек таңдалған беттердің мәтінін, режимді және жауап тілін жібереді; профиль, email, токендер, қолтаңбалы URL немесе бүкіл кітап жіберілмейді. Тегін тарифте Google мазмұнды сервисті жетілдіру үшін пайдалануы және адамдар тексеруі мүмкін; құпия деректерді таңдамаңыз. Әкімші PDF мәтінін бет бойынша бір рет Supabase-ке шығарады. Жауап кэшінде иесі, оқулық нұсқасы, аралық, режим, тіл, дереккөз хэші, жауап пен уақыт сақталады; санауыш генерация талпыныстарын шектейді. Дереккөз өзгерсе, ескі кэш жарамсыз болады. Оператор сақтау мерзімін белгілеп, деректерді жою өтініштерінде кэшті өшіруі керек. AI қателесуі мүмкін: нәтижені дәйексөздер және көрсетілген беттермен салыстырыңыз."
      ]
    ],
    "terms": [
      [
        "Жоба және оператор",
        "NIS Hub — тегін сынақ оқу жобасы, мектептің не НЗМ желісінің ресми қызметі деп мәлімделмейді. Мектептің ресми мақұлдауы туралы мәлімдеме жоқ. Оператор: [АТЫ / ҰЙЫМЫН КӨРСЕТУ]. Байланыс: [ЖҰМЫС EMAIL КӨРСЕТУ]."
      ],
      [
        "Аккаунт",
        "Құпиясөз бен email қолжетімділігін қорғаңыз, аккаунтты бермеңіз және өзіңізді басқа адам ретінде көрсетпеңіз. Қолжетімділік кәмелетке толғандарға (18+) арналған. Қауіп туралы операторға құпиясөз бен токенді бермей хабарлаңыз."
      ],
      [
        "Рұқсатты пайдалану",
        "Сайтты берілген қолжетімділік шегінде оқу үшін пайдаланыңыз. Авторизация мен шектеулерді айналып өтуге, өзгенің деректерін алуға, зиянды файл жүктеуге, қорлауға және сайт жұмысын бұзуға тыйым салынады."
      ],
      [
        "Материалдар және кесте",
        "Әкімші материалды тек расталған құқық пен жариялау рұқсаты болғанда орналастырады. Оқу мақсатында қолдану оқулықты таратуға өздігінен рұқсат бермейді. Кестені импорттау тиісті деректерге рұқсатты талап етеді. EduPage-тен оқушы туралы немесе жабық деректерді көшірмеңіз."
      ],
      [
        "Аватарлар және жеке мазмұн",
        "Тек қажетті құқықтарыңыз бар рұқсатты суреттерді жүктеңіз. Өзгенің жеке деректерін, қорлайтын, заңсыз немесе зиянды мазмұнды жүктемеңіз. Аватар ауысқанда ескі файл қайта жазылады; қолданбада бұрынғы нұсқаны қалпына келтіру жоқ."
      ],
      [
        "Қорғалған файлдар",
        "PDF пен аватарлар жеке Storage ішінде; уақытша қолтаңбалы сілтеме шектеулі мерзімге қолжетімділік береді. Тиісті құқықсыз сілтеме, токен не материал көшірмесін жарияламаңыз. Жеке bucket DRM емес және алынған көшірмені сақтауға бөгет болмайды."
      ],
      [
        "Қолжетімділік және қауіпсіздік",
        "Beta-нұсқада қателер, үзілістер, ескірген кесте және функция өзгерістері болуы мүмкін. Маңызды кесте өзгерісін мектептен растаңыз. Теріс пайдалану не қауіп кезінде оператор әкімшілік құралдармен қолжетімділікті шектей алады; қолданбада бөлек шағымдану механизмі әзірше жоқ. Байланыс пен өтініш қарау тәртібі іске қосуға дейін толтырылуы керек."
      ],
      [
        "Құны, өзгерістер және деректер",
        "Төлемдер мен жазылымдар жоқ; жоқ сатып алуларға қайтарым ережесі қолданылмайды. Болашақ ақылы функцияларға бөлек шарттар қажет. Бұл шарттар жоба күйінде: күшіне ену күні мен өзгерісті хабарлау тәртібі бекітілмеген. Деректерді өңдеу құпиялық саясатында сипатталған."
      ],
      [
        "Кәмелетке толған аудитория",
        "Иесінің растауы бойынша сервис кәмелетке толған (18+) пайдаланушыларға арналған. Gemini іске қосылғанға дейін оператор қолжетімділікті тиісінше шектеуі керек; қолданба жасты техникалық тексермейді. Артық жеке деректер мен басқа адамдардың суреттерін қоспаңыз. Бұл жоба заң талаптарына сәйкестікті растамайды."
      ]
    ]
  },
  "en": {
    "draft": "Draft · not legal advice",
    "intro": "NIS Hub is a beta learning project. These drafts describe the current implementation but require operator details and legal review before public launch.",
    "revision": "Draft revised: 14 September 2026. Effective date: [SET AFTER REVIEW].",
    "privacyTitle": "Privacy Policy",
    "termsTitle": "Terms of Use",
    "privacy": [
      [
        "Operator and contact",
        "NIS Hub operator: [INSERT NAME / ORGANISATION AND ADDRESS]. Data, security and deletion contact: [INSERT WORKING EMAIL]. Until these fields are completed, no published request-handling contact is available."
      ],
      [
        "Account and profile",
        "Supabase Auth processes your email, password and session information for registration and sign-in. The Supabase database stores your account ID, display name, class, up to four favourite subjects (Top 4), role, timestamps and avatar path. A biography field exists in the schema but is not currently editable in the interface."
      ],
      [
        "Avatar and reading",
        "Your avatar is stored in private Supabase Storage at <uid>/avatar.webp. The application converts it to WebP and strips metadata; a new upload overwrites the previous file. Its update timestamp supports replacement limits. Bookmarks and the last-read page are stored against your account and book."
      ],
      [
        "Purpose and access",
        "Data supports sign-in, your profile, class selection, bookmarks and reading continuity. Application access rules restrict profiles, avatars and reading history to their owners; infrastructure operators and the service provider may have technical access. Signed-in users can see published materials and timetables."
      ],
      [
        "Services and timetable",
        "The connected external service is Supabase: Auth, database and Storage. Hosting provider and region: [CONFIRM ACTUAL DEPLOYMENT]; Vercel is not claimed as a connected service. PDF.js and Reader fonts are served by this site. There is no automatic EduPage integration: an administrator can import authorised CSV/TSV containing class, subject, weekday, lesson range, times, effective dates and optional teacher/room information. Historical date-based schedules are retained."
      ],
      [
        "Cookies and local preferences",
        "Supabase cookies maintain sign-in and session refresh; their lifetime depends on Auth configuration. The nis-locale cookie stores the interface language for up to one year and is sent to the server. The nis-theme localStorage key keeps Light/Dark until changed or cleared; that theme preference is not sent to the server. Library filters appear in the URL and may enter browser history and request logs when a link is opened."
      ],
      [
        "Analytics and technical logs",
        "NIS Hub code contains no advertising or analytics trackers. Supabase and the actual host may process request and security logs. The operator must clarify their scope and retention before launch. Do not include passwords, tokens or private signed URLs in error reports."
      ],
      [
        "Retention, correction and deletion",
        "You can edit your profile, remove bookmarks and replace your avatar. Self-service account deletion and automatic time-based cleanup are not implemented. Request access to or deletion of your data from the operator using the contact above once completed. The operator must verify account ownership, delete the account and dependent records, separately remove the avatar through the Storage API, and check log/backup retention. Retention and response periods: [SET BEFORE LAUNCH]."
      ],
      [
        "Adult audience",
        "The owner confirmed an adult (18+) audience. The operator must enforce appropriate access restrictions before enabling Gemini; the application does not technically verify age. Do not add unnecessary personal data or other people's images. This draft does not certify legal compliance."
      ],
      [
        "Gemini AI Study · beta",
        "AI Study is optional and off until configured by the operator. On request, the server sends Google Gemini only selected page text, mode and response language — not your profile, email, tokens, signed URLs or the whole book. Free-tier content may be used by Google to improve services and reviewed by humans; do not select confidential data. An admin extracts PDF text once per page into Supabase. The response cache stores its owner, edition, range, mode, locale, source hash, response and timestamp; a counter limits generation attempts. Replacing the source invalidates old cache entries. The operator must set retention periods and remove cached responses for data-deletion requests. AI can be wrong: compare claims with quotations and the indicated pages."
      ]
    ],
    "terms": [
      [
        "Project and operator",
        "NIS Hub is a free beta learning project, not a claimed official service of the school or NIS network. No official school endorsement is asserted. Operator: [INSERT NAME / ORGANISATION]. Contact: [INSERT WORKING EMAIL]."
      ],
      [
        "Accounts",
        "Protect your password and email access, do not share your account or impersonate another person. Access is intended for adults (18+). Report suspected compromise to the operator without sharing passwords or tokens."
      ],
      [
        "Acceptable use",
        "Use the site for learning within your authorised access. Do not bypass authentication or restrictions, access other people's data, upload malicious files, harass others or disrupt the service."
      ],
      [
        "Materials and timetable",
        "Administrators may publish materials only with verified rights and permission. Educational use alone does not permit redistribution of a textbook. Timetable imports require permission for the relevant data. Do not copy student information or restricted EduPage data."
      ],
      [
        "Avatars and personal content",
        "Upload only permitted images for which you have the necessary rights. Do not upload other people's personal information, abusive, unlawful or malicious content. Replacing an avatar overwrites the previous file; the application does not offer recovery of previous versions."
      ],
      [
        "Protected files",
        "PDFs and avatars use private Storage; signed links grant access for a limited period. Do not publish links, tokens or material copies without the relevant rights. A private bucket is not DRM and cannot prevent retaining a copy already received."
      ],
      [
        "Availability and security",
        "Beta software may have errors, interruptions, outdated timetables and changing features. Confirm important timetable changes with the school. The operator can restrict access for abuse or security threats using administration tools; no separate in-app appeals mechanism exists yet. Contact details and a request-handling process must be completed before launch."
      ],
      [
        "Cost, changes and data",
        "There are no payments or subscriptions; refund terms do not apply to nonexistent purchases. Any future paid features require separate terms. These terms remain a draft: the effective date and change-notification process are not established. Data processing is described in the Privacy Policy."
      ],
      [
        "Adult audience",
        "The owner confirmed an adult (18+) audience. The operator must enforce appropriate access restrictions before enabling Gemini; the application does not technically verify age. Do not add unnecessary personal data or other people's images. This draft does not certify legal compliance."
      ]
    ]
  }
} satisfies Record<Locale, LegalCopy>;
const communityPrivacy: Record<Locale, [string,string]> = {
 ru: ["Личные сообщения", "Отображаемое имя уникально: другой авторизованный пользователь может начать переписку, введя его полностью. Supabase хранит участников, тексты сообщений, время отправки, отметки прочтения и уведомления. В интерфейсе переписка доступна только её участникам; сквозного шифрования нет, инфраструктура оператора обрабатывает содержание. Уведомления обновляются в открытой вкладке сайта; фоновые push-уведомления не используются."],
 kk: ["Жеке хабарламалар", "Көрсетілетін ат бірегей: жүйеге кірген басқа пайдаланушы толық атты енгізіп, хат алмасуды бастай алады. Supabase қатысушыларды, хабарлама мәтіндерін, жіберілген уақытты, оқылған белгілерді және хабарландыруларды сақтайды. Интерфейсте хат алмасу тек қатысушыларға қолжетімді; ұштан-ұшқа шифрлау жоқ, мазмұн оператор инфрақұрылымында өңделеді. Хабарландырулар сайттың ашық қойындысында жаңартылады; фондық push-хабарландырулар қолданылмайды."],
 en: ["Direct messages", "Display names are unique: another signed-in user can start a conversation by entering your full name. Supabase stores participants, message text, timestamps, read markers and notifications. In the app, conversations are accessible only to their participants; messages are not end-to-end encrypted and operator infrastructure processes their content. Notifications update in an open website tab; background push notifications are not used."]
};
import {v053Legal} from "./v053-legal-copy";
export const legalCopy = Object.fromEntries(Object.entries(baseLegalCopy).map(([key,copy])=>{
 const locale=key as Locale;
 return [locale,{...copy,privacy:[...copy.privacy,supportLegalCopy[locale].privacy,communityPrivacy[locale],v053Legal[locale].privacy],terms:[...copy.terms,supportLegalCopy[locale].terms,v053Legal[locale].terms]}];
})) as Record<Locale,LegalCopy>;

const smsPrivacy: Record<Locale,[string,string]> = {
 ru:["Школьный SMS-дневник · v0.5.5","По запросу пользователя NIS Hub передаёт ИИН и пароль через HTTPS школьной системе sms.ura.nis.edu.kz для входа. Учётные данные обрабатываются временно на сервере, не сохраняются в базе, браузерном хранилище или журнале приложения. Школьные cookies шифруются AES-256-GCM и привязываются к пользователю NIS Hub: сессия действует максимум 30 минут либо меньше по сроку SMS. Обычно она находится в HttpOnly cookie; при превышении размера cookie в Supabase хранится только шифротекст с TTL, а браузер получает случайный идентификатор. Просроченные строки недоступны, удаляются при следующем сохранении и по настроенному оператором расписанию очистки; резервные копии имеют отдельный срок хранения оператора. Отключение удаляет локальную сессию, а доступные строки шифротекста — из базы. Оценки обрабатываются в памяти сервера и открытой страницы, не сохраняются в базе NIS Hub и не передаются в Gemini или Telegram. Запросы выполняются при подключении, открытии дневника с сессией и ручном обновлении. Это независимый интерфейс, не официальная оценка или замена SMS. Владелец подтвердил разрешение на интеграцию; перед запуском оператор должен проверить объём разрешения, уведомление пользователей и сроки хранения."],
 kk:["Мектептің SMS күнделігі · v0.5.5","Пайдаланушы сұрағанда NIS Hub ЖСН мен құпиясөзді HTTPS арқылы sms.ura.nis.edu.kz мектеп жүйесіне кіру үшін жібереді. Олар серверде уақытша өңделеді, дерекқорда, браузер қоймасында немесе қолданба журналында сақталмайды. SMS cookies AES-256-GCM арқылы шифрланып, NIS Hub пайдаланушысына байланысады; сессия ең көбі 30 минут немесе SMS мерзімі қысқарақ болса, соған дейін жарамды. Әдетте ол HttpOnly cookie ішінде болады; көлемі асып кетсе, Supabase тек TTL бар шифрланған мәтінді сақтайды, ал браузер кездейсоқ идентификатор алады. Мерзімі өткен жазбалар қолжетімсіз, келесі сақтауда және оператор баптаған тазалау кестесі бойынша жойылады; резервтік көшірмелердің сақтау мерзімін оператор анықтайды. Ажырату жергілікті сессияны және қолжетімді шифрланған жазбаларды жояды. Бағалар сервер мен ашық беттің жадында өңделеді, NIS Hub базасында сақталмайды, Gemini не Telegram-ға жіберілмейді. Сұраулар қосылу, сессиямен күнделікті ашу және қолмен жаңарту кезінде жасалады. Бұл ресми баға немесе SMS-ті алмастыру емес. Иесі интеграцияға рұқсатты растады; іске қосар алдында оператор рұқсат аясын, хабарлауды және сақтау мерзімін тексеруі керек."],
 en:["School SMS diary · v0.5.5","At your request, NIS Hub sends your IIN and password over HTTPS to the school system sms.ura.nis.edu.kz to sign in. Credentials are processed transiently on the server, not stored in the database, browser storage or application logs. SMS cookies are AES-256-GCM encrypted and bound to your NIS Hub account, for at most 30 minutes or the shorter SMS lifetime. Normally stored in an HttpOnly cookie, larger encrypted sessions use TTL storage in Supabase and an opaque browser identifier. Expired rows cannot be read and are removed on subsequent saves and the operator-configured cleanup schedule; backup retention is separately determined by the operator. Disconnect clears the local session and available encrypted database rows. Grades are processed in server and open-page memory, not stored in the NIS Hub database or sent to Gemini or Telegram. Requests occur on connection, opening the diary with a session and explicit refresh. This independent interface does not replace official SMS grades. The owner confirmed integration permission; before launch the operator must verify its scope, user notice and retention."]
};
for (const locale of ["ru","kk","en"] as const) legalCopy[locale].privacy.push(smsPrivacy[locale]);
