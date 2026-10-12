import type { Locale } from "./i18n";

const copy = {
  ru: {
    title: "Разберём материал",
    subtitle: "От страницы учебника к понятному конспекту.",
    range: "Страницы учебника",
    current: "Текущая страница",
    task: "Что подготовить?",
    rangeHint: "Для быстрого ответа начните с 1–3 страниц.",
    invalidRange: "Выберите целые номера страниц в допустимом диапазоне.",
    emptyTitle: "Ваш материал, понятнее",
    emptyHint:
      "Выберите страницы и задачу. Здесь появится ответ с цитатами из учебника.",
    loading: "Готовим ответ по выбранным страницам",
    loadingHint:
      "Gemini читает материал. Большой диапазон может занять больше времени.",
    slow: "Ответ ещё готовится",
    slowHint:
      "Сервис отвечает дольше обычного. Дождитесь результата, чтобы не отправлять запрос повторно.",
    retry: "Повторить запрос",
    onePage: "Разобрать одну страницу",
    errorTitle: "Ответ не готов",
    ready: "Материал готов",
    privacy: "О запросе и лимитах",
    daily: "запросов в день",
    characters: "символов",
    upTo: "До",
    descriptions: {
      summary: "Главное без лишнего",
      review: "Вспомнить и закрепить",
      sor: "Подготовиться к разделу",
      soch: "Повторить к четверти",
      questions: "Проверить себя по материалу",
    },
  },
  kk: {
    title: "Материалды түсінейік",
    subtitle: "Оқулық бетінен түсінікті конспектіге.",
    range: "Оқулық беттері",
    current: "Ағымдағы бет",
    task: "Не дайындаймыз?",
    rangeHint: "Жылдам жауап үшін 1–3 беттен бастаңыз.",
    invalidRange: "Рұқсат етілген аралықтағы бүтін бет нөмірлерін таңдаңыз.",
    emptyTitle: "Материалды түсіну оңай",
    emptyHint:
      "Беттер мен тапсырманы таңдаңыз. Мұнда оқулық дәйексөздері бар жауап пайда болады.",
    loading: "Таңдалған беттер бойынша жауап дайындалуда",
    loadingHint:
      "Gemini материалды оқып жатыр. Үлкен аралық көбірек уақыт алуы мүмкін.",
    slow: "Жауап әлі дайындалуда",
    slowHint:
      "Сервис әдеттегіден баяу жауап беруде. Сұрауды қайталамай, нәтижені күтіңіз.",
    retry: "Сұрауды қайталау",
    onePage: "Бір бетті талдау",
    errorTitle: "Жауап дайын емес",
    ready: "Материал дайын",
    privacy: "Сұрау мен шектеулер",
    daily: "күндік сұрау",
    characters: "таңба",
    upTo: "Ең көбі",
    descriptions: {
      summary: "Ең маңызды мәліметтер",
      review: "Еске түсіру және бекіту",
      sor: "Бөлімге дайындалу",
      soch: "Тоқсанды қайталау",
      questions: "Материал бойынша өзіңді тексеру",
    },
  },
  en: {
    title: "Make sense of the material",
    subtitle: "From textbook pages to clear study notes.",
    range: "Textbook pages",
    current: "Current page",
    task: "What would you like to prepare?",
    rangeHint: "Start with 1–3 pages for a quicker answer.",
    invalidRange: "Choose whole page numbers within the allowed range.",
    emptyTitle: "Your material, made clearer",
    emptyHint:
      "Choose pages and a task. Your answer will appear here with quotes from the textbook.",
    loading: "Preparing an answer from your pages",
    loadingHint:
      "Gemini is reading the material. Larger ranges can take longer.",
    slow: "Your answer is still being prepared",
    slowHint:
      "The service is taking longer than usual. Wait for the result before sending another request.",
    retry: "Retry request",
    onePage: "Study one page",
    errorTitle: "Answer not ready",
    ready: "Study notes ready",
    privacy: "About requests and limits",
    daily: "requests per day",
    characters: "characters",
    upTo: "Up to",
    descriptions: {
      summary: "Just the essentials",
      review: "Recall and reinforce",
      sor: "Prepare for the unit",
      soch: "Revise for the term",
      questions: "Test yourself on the material",
    },
  },
};

export const aiStudyPanelCopy = (locale: Locale) => copy[locale];
