const copy = {
  ru: {
    total: "Всего за год",
    busiest: "Самый активный день",
    longest: "Лучшая серия",
    current: "Серия заходов",
    dayForms: ["день", "дня", "дней"],
    none: "Нет",
    year: "за последний год",
    view: "Вид активности",
    flat: "Календарь активности",
    skyline: "Город активности 3D",
    between: "за период",
    shown: "вид",
    keys: "Используйте стрелки для просмотра дней.",
    less: "Меньше",
    more: "Больше",
    levels: [
      "Без активности",
      "Низкая",
      "Умеренная",
      "Высокая",
      "Максимальная",
    ],
    highlight: "Выделить дни",
    hover: "Наведите на день или выберите его стрелками",
    orbit: "Перетащите для поворота · двойной щелчок сбрасывает вид",
  },
  kk: {
    total: "Бір жылдағы белсенділік",
    busiest: "Ең белсенді күн",
    longest: "Ең ұзақ қатар",
    current: "Кіру қатары",
    dayForms: ["күн", "күн", "күн"],
    none: "Жоқ",
    year: "соңғы бір жылда",
    view: "Белсенділік көрінісі",
    flat: "Белсенділік күнтізбесі",
    skyline: "3D белсенділік қаласы",
    between: "аралық",
    shown: "көрініс",
    keys: "Күндерді көру үшін бағыттауыш пернелерді пайдаланыңыз.",
    less: "Аз",
    more: "Көп",
    levels: ["Белсенділік жоқ", "Төмен", "Орташа", "Жоғары", "Ең жоғары"],
    highlight: "Күндерді ерекшелеу",
    hover: "Күнді таңдаңыз немесе бағыттауыш пернелерді пайдаланыңыз",
    orbit: "Бұру үшін сүйреңіз · екі рет басу көріністі қалпына келтіреді",
  },
  en: {
    total: "1 year total",
    busiest: "Busiest day",
    longest: "Longest streak",
    current: "Visit streak",
    dayForms: ["day", "days", "days"],
    none: "No",
    year: "in the last year",
    view: "Chart view",
    flat: "Flat heat map",
    skyline: "3D skyline",
    between: "between",
    shown: "shown as",
    keys: "Use the arrow keys to read individual days.",
    less: "Less",
    more: "More",
    levels: ["No activity", "Light", "Moderate", "Heavy", "Heaviest"],
    highlight: "Highlight days",
    hover: "Hover a day for details · arrow keys to explore",
    orbit: "Drag to orbit · double-click to reset",
  },
};
export function skylineCopy(locale: string) {
  return locale.startsWith("ru")
    ? copy.ru
    : locale.startsWith("kk")
      ? copy.kk
      : copy.en;
}
export function activityNoun(
  count: number,
  forms: readonly string[],
  locale: string,
) {
  const category = new Intl.PluralRules(locale).select(count);
  return forms[category === "one" ? 0 : category === "few" ? 1 : 2] ?? forms[0];
}
