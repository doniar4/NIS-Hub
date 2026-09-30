import type { Locale } from "@/lib/i18n";

const copy = {
  ru: {
    title: "Подтвердите вход в SMS", description: "Введите код с изображения или код подтверждения, который запросила школьная система.",
    captcha: "Код с изображения", imageAlt: "CAPTCHA школьной системы SMS", twoFactor: "Код двухфакторной проверки", application: "Код из приложения-аутентификатора",
    submit: "Продолжить вход", cancel: "Отменить", expires: "Завершите проверку до", official: "Открыть официальный сайт SMS",
    sendCode: "Отправить код", codeWait: "Повторная отправка доступна через минуту",
    unsupported: "Этот шаг проверки нужно выполнить на официальном сайте SMS. Затем попробуйте подключиться снова; проверка на сайте не переносит сессию в NIS Hub.",
  },
  kk: {
    title: "SMS жүйесіне кіруді растаңыз", description: "Суреттегі кодты немесе мектеп жүйесі сұраған растау кодын енгізіңіз.",
    captcha: "Суреттегі код", imageAlt: "Мектептің SMS жүйесінің CAPTCHA суреті", twoFactor: "Екі факторлы тексеру коды", application: "Аутентификатор қолданбасындағы код",
    submit: "Кіруді жалғастыру", cancel: "Бас тарту", expires: "Тексеруді аяқтау уақыты", official: "Ресми SMS сайтын ашу",
    sendCode: "Код жіберу", codeWait: "Кодты бір минуттан кейін қайта жіберуге болады",
    unsupported: "Бұл тексеруді ресми SMS сайтында орындау керек. Содан кейін қайта қосылып көріңіз; сайттағы тексеру сессияны NIS Hub жүйесіне көшірмейді.",
  },
  en: {
    title: "Verify your SMS sign-in", description: "Enter the image code or verification code requested by your school’s system.",
    captcha: "Code from the image", imageAlt: "School SMS CAPTCHA", twoFactor: "Two-factor verification code", application: "Authenticator app code",
    submit: "Continue sign-in", cancel: "Cancel", expires: "Complete verification by", official: "Open the official SMS website",
    sendCode: "Send code", codeWait: "You can resend the code after one minute",
    unsupported: "Complete this verification step on the official SMS website, then try connecting again. Verification there does not transfer that session to NIS Hub.",
  },
} satisfies Record<Locale, Record<string, string>>;

export const smsChallengeCopy = (locale: Locale) => copy[locale];
