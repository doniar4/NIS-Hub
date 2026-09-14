import {supportLegalCopy} from "./support-legal-copy";
import type { Locale } from "./i18n";
type LegalCopy = { draft: string; intro: string; revision: string; privacyTitle: string; termsTitle: string; privacy: [string, string][]; terms: [string, string][] };
const baseLegalCopy = {
  "ru": {
    "draft": "Черновик · не юридическая консультация",
    "intro": "NIS Hub — тестовый учебный проект. Эти тексты описывают текущую реализацию, но требуют заполнения реквизитов и юридической проверки до публичного запуска.",
    "revision": "Редакция черновика: 14.09.2026. Дата вступления в силу: [УКАЗАТЬ ПОСЛЕ ПРОВЕРКИ].",
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
        "Cookies Supabase поддерживают вход и обновление сессии; их срок зависит от настройки Auth. Cookie nis-locale сохраняет язык на срок до года и передаётся серверу. Ключ nis-theme в localStorage хранит выбор Light/Dark/System до очистки или изменения; сам выбор темы серверу не отправляется. Поисковые фильтры библиотеки отражаются в URL, поэтому могут попасть в историю браузера и журнал запросов при открытии ссылки."
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
        "Учащиеся и изменения",
        "Аудитория включает несовершеннолетних. Не добавляйте лишние персональные данные и изображения других людей без необходимых прав. Оператор должен определить применимые возрастные условия, участие родителей/школы и основания обработки до запуска. Этот черновик не подтверждает соответствие каким-либо законам. Изменения будут отражены в дате редакции; порядок уведомления ещё должен быть определён."
      ]
    ],
    "terms": [
      [
        "Проект и оператор",
        "NIS Hub — бесплатный тестовый учебный проект, а не заявленный официальный сервис школы или сети НИШ. Официальное одобрение школы не утверждается. Оператор: [УКАЗАТЬ ИМЯ / ОРГАНИЗАЦИЮ]. Контакт: [УКАЗАТЬ РАБОЧИЙ EMAIL]."
      ],
      [
        "Аккаунт",
        "Берегите пароль и доступ к email, не передавайте аккаунт другим и не выдавайте себя за другого человека. Возрастные условия и порядок участия родителей/школы необходимо определить перед публичным запуском. О подозрении на компрометацию сообщайте оператору без передачи пароля или токенов."
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
      ]
    ]
  },
  "kk": {
    "draft": "Жоба · заңгерлік кеңес емес",
    "intro": "NIS Hub — сынақтағы оқу жобасы. Бұл мәтіндер қазіргі жұмысты сипаттайды; көпшілікке іске қоспас бұрын деректемелер толтырылып, заңгер тексеруі керек.",
    "revision": "Жоба редакциясы: 14.09.2026. Күшіне ену күні: [ТЕКСЕРУДЕН КЕЙІН КӨРСЕТУ].",
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
        "Supabase cookies кіруді және сессияны жаңартуды қолдайды; мерзімі Auth баптауына байланысты. nis-locale cookie тілді бір жылға дейін сақтап, серверге жіберіледі. localStorage ішіндегі nis-theme Light/Dark/System таңдауын тазартылғанша не өзгертілгенше сақтайды; тақырып таңдауы серверге жіберілмейді. Кітапхана сүзгілері URL-де болады, сондықтан сілтемені ашқанда браузер тарихы мен сұрау журналына түсуі мүмкін."
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
        "Оқушылар және өзгерістер",
        "Аудиторияда кәмелетке толмағандар бар. Артық жеке деректерді және басқа адамдардың суреттерін тиісті құқықсыз қоспаңыз. Оператор жас талаптарын, ата-ана/мектеп қатысуын және өңдеу негіздерін іске қосар алдында анықтауы керек. Бұл жоба заң талаптарына сәйкестікті растамайды. Өзгерістер редакция күнімен белгіленеді; хабарлау тәртібі әлі анықталуы керек."
      ]
    ],
    "terms": [
      [
        "Жоба және оператор",
        "NIS Hub — тегін сынақ оқу жобасы, мектептің не НЗМ желісінің ресми қызметі деп мәлімделмейді. Мектептің ресми мақұлдауы туралы мәлімдеме жоқ. Оператор: [АТЫ / ҰЙЫМЫН КӨРСЕТУ]. Байланыс: [ЖҰМЫС EMAIL КӨРСЕТУ]."
      ],
      [
        "Аккаунт",
        "Құпиясөз бен email қолжетімділігін қорғаңыз, аккаунтты бермеңіз және өзіңізді басқа адам ретінде көрсетпеңіз. Жас талаптары мен ата-ана/мектеп қатысу тәртібі жария іске қосуға дейін анықталуы керек. Қауіп туралы операторға құпиясөз бен токенді бермей хабарлаңыз."
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
        "Supabase cookies maintain sign-in and session refresh; their lifetime depends on Auth configuration. The nis-locale cookie stores the interface language for up to one year and is sent to the server. The nis-theme localStorage key keeps Light/Dark/System until changed or cleared; that theme preference is not sent to the server. Library filters appear in the URL and may enter browser history and request logs when a link is opened."
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
        "Students and changes",
        "The audience includes minors. Avoid unnecessary personal information and images of other people without the required rights. Before launch, the operator must determine age requirements, parent/school involvement and grounds for processing. This draft does not claim legal compliance. Revisions will carry an updated date; the notification process still needs to be established."
      ]
    ],
    "terms": [
      [
        "Project and operator",
        "NIS Hub is a free beta learning project, not a claimed official service of the school or NIS network. No official school endorsement is asserted. Operator: [INSERT NAME / ORGANISATION]. Contact: [INSERT WORKING EMAIL]."
      ],
      [
        "Accounts",
        "Protect your password and email access, do not share your account or impersonate another person. Age requirements and parent/school participation must be defined before public launch. Report suspected compromise to the operator without sharing passwords or tokens."
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
      ]
    ]
  }
} satisfies Record<Locale, LegalCopy>;
export const legalCopy = Object.fromEntries(Object.entries(baseLegalCopy).map(([key,copy])=>{
 const locale=key as Locale;
 return [locale,{...copy,privacy:[...copy.privacy,supportLegalCopy[locale].privacy],terms:[...copy.terms,supportLegalCopy[locale].terms]}];
})) as Record<Locale,LegalCopy>;
