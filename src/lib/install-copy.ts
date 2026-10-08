import type { Locale } from "./i18n";

const copy = {
  ru: {
    title: "Установить NIS Hub",
    homeTitle: "Установите NIS Hub",
    body: "Добавьте NIS Hub на главный экран и открывайте его как обычное приложение.",
    how: "Как добавить",
    show: "Показать как",
    later: "Не сейчас",
    reminder:
      "Вы часто пользуетесь NIS Hub. Добавьте его на главный экран за несколько секунд.",
    subtitle: "Добавить на главный экран",
    installed: "NIS Hub установлен",
    installedHint: "Открывайте NIS Hub с главного экрана.",
    close: "Закрыть инструкцию",
    native: "Установить NIS Hub",
    busy: "Открываем установку…",
    failed: "Не удалось открыть установку. Используйте инструкции ниже.",
    safariNote: "Для добавления на главный экран откройте NIS Hub в Safari.",
    androidNote:
      "В этом браузере установка может быть недоступна. Откройте NIS Hub в Chrome.",
    desktopNote:
      "На телефоне откройте NIS Hub в Safari на iPhone или Chrome на Android и выберите добавление на главный экран.",
    ios: [
      "Нажмите «Поделиться» в Safari.",
      "Выберите «На экран „Домой“» (при необходимости откройте «Ещё»).",
      "Нажмите «Добавить». Если доступен переключатель «Открывать как веб-приложение», оставьте его включённым.",
    ],
    android: [
      "Откройте меню Chrome (⋮).",
      "Выберите «Добавить на главный экран» или «Установить приложение», если этот пункт доступен.",
      "Подтвердите добавление или установку.",
    ],
    manual: "Или добавьте вручную:",
  },
  kk: {
    title: "NIS Hub орнату",
    homeTitle: "NIS Hub-ты орнатыңыз",
    body: "NIS Hub-ты басты экранға қосып, оны кәдімгі қолданба сияқты ашыңыз.",
    how: "Қалай қосуға болады",
    show: "Нұсқаулықты көрсету",
    later: "Қазір емес",
    reminder:
      "Сіз NIS Hub-ты жиі қолданасыз. Оны бірнеше секундта басты экранға қосыңыз.",
    subtitle: "Басты экранға қосу",
    installed: "NIS Hub орнатылған",
    installedHint: "NIS Hub-ты басты экраннан ашыңыз.",
    close: "Нұсқаулықты жабу",
    native: "NIS Hub орнату",
    busy: "Орнатуды ашып жатырмыз…",
    failed: "Орнатуды ашу мүмкін болмады. Төмендегі нұсқаулықты қолданыңыз.",
    safariNote: "Басты экранға қосу үшін NIS Hub-ты Safari-де ашыңыз.",
    androidNote:
      "Бұл браузерде орнату мүмкіндігі болмауы мүмкін. NIS Hub-ты Chrome-да ашыңыз.",
    desktopNote:
      "Телефонда NIS Hub-ты iPhone үшін Safari-де немесе Android үшін Chrome-да ашып, басты экранға қосуды таңдаңыз.",
    ios: [
      "Safari-де «Бөлісу» батырмасын басыңыз.",
      "«Басты экранға қосу» тармағын таңдаңыз (қажет болса, «Тағы» бөлімін ашыңыз).",
      "«Қосу» батырмасын басыңыз. Қолжетімді болса, веб-қолданба ретінде ашу ауыстырғышын қосулы қалдырыңыз.",
    ],
    android: [
      "Chrome мәзірін ашыңыз (⋮).",
      "Қолжетімді болса, «Басты экранға қосу» немесе «Қолданбаны орнату» тармағын таңдаңыз.",
      "Қосуды немесе орнатуды растаңыз.",
    ],
    manual: "Немесе қолмен қосыңыз:",
  },
  en: {
    title: "Install NIS Hub",
    homeTitle: "Install NIS Hub",
    body: "Add NIS Hub to your home screen and open it like an app.",
    how: "How to add",
    show: "Show me how",
    later: "Not now",
    reminder:
      "You use NIS Hub often. Add it to your home screen in a few seconds.",
    subtitle: "Add to home screen",
    installed: "NIS Hub is installed",
    installedHint: "Open NIS Hub from your home screen.",
    close: "Close installation guide",
    native: "Install NIS Hub",
    busy: "Opening installation…",
    failed: "Could not open installation. Use the instructions below.",
    safariNote: "To add NIS Hub to your home screen, open it in Safari.",
    androidNote:
      "Installation may not be available in this browser. Open NIS Hub in Chrome.",
    desktopNote:
      "On your phone, open NIS Hub in Safari on iPhone or Chrome on Android and choose to add it to your home screen.",
    ios: [
      "Tap Share in Safari.",
      "Choose Add to Home Screen (open More if needed).",
      "Tap Add. Keep Open as Web App enabled if that switch is available.",
    ],
    android: [
      "Open the Chrome menu (⋮).",
      "Choose Add to home screen or Install app, if available.",
      "Confirm adding or installing.",
    ],
    manual: "Or add it manually:",
  },
} as const;
export const installCopy = (locale: Locale) => copy[locale];
