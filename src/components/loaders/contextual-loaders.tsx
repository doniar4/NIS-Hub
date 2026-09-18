"use client";

import { useI18n } from "@/components/locale-provider";

const chatTranslations = {
  messages: {
    ru: { title: "Загрузка сообщений...", subtitle: "Синхронизация диалогов" },
    kk: { title: "Хабарламалар жүктелуде...", subtitle: "Диалогтарды синхрондау" },
    en: { title: "Loading messages...", subtitle: "Syncing conversations" },
  },
  support: {
    ru: { title: "Загрузка обращений...", subtitle: "Проверка заявок и ответов" },
    kk: { title: "Өтініштер жүктелуде...", subtitle: "Өтініштер мен жауаптарды тексеру" },
    en: { title: "Loading tickets...", subtitle: "Checking requests and replies" },
  },
};

const cardTranslations = {
  library: {
    ru: "Загрузка библиотеки...",
    kk: "Кітапхана жүктелуде...",
    en: "Loading library...",
  },
  profile: {
    ru: "Загрузка профиля...",
    kk: "Профиль жүктелуде...",
    en: "Loading profile...",
  },
  default: {
    ru: "Загрузка материалов...",
    kk: "Материалдар жүктелуде...",
    en: "Loading materials...",
  },
};

const pencilTranslations = {
  hub: {
    ru: { title: "Загрузка NIS Hub...", caption: "Подготовка учебного пространства" },
    kk: { title: "NIS Hub жүктелуде...", caption: "Оқу кеңістігін дайындау" },
    en: { title: "Loading NIS Hub...", caption: "Preparing study space" },
  },
  schedule: {
    ru: { title: "Загрузка расписания...", caption: "Формирование уроков и смен" },
    kk: { title: "Сабақ кестесі жүктелуде...", caption: "Сабақтар мен ауысымдарды құру" },
    en: { title: "Loading schedule...", caption: "Preparing lessons and shifts" },
  },
  diary: {
    ru: { title: "Загрузка дневника...", caption: "Синхронизация четвертей и оценок" },
    kk: { title: "Күнделік жүктелуде...", caption: "Тоқсандар мен бағаларды синхрондау" },
    en: { title: "Loading diary...", caption: "Syncing terms and grades" },
  },
  reader: {
    ru: { title: "Загрузка книги...", caption: "Загрузка страниц и оглавления" },
    kk: { title: "Кітап жүктелуде...", caption: "Беттер мен мазмұны жүктелуде" },
    en: { title: "Loading book...", caption: "Loading pages and table of contents" },
  },
  default: {
    ru: { title: "Загрузка данных...", caption: "Готовим материалы и расписание" },
    kk: { title: "Деректер жүктелуде...", caption: "Материалдар мен кесте дайындалуда" },
    en: { title: "Loading data...", caption: "Preparing materials and schedule" },
  },
};

/**
 * Loader 1: Chat / Tickets Skeleton Loader
 * Based on Uiverse.io by sahilxkhadka
 */
export function ChatSkeletonLoader({
  kind = "messages",
  title,
  subtitle,
}: {
  kind?: "messages" | "support";
  title?: string;
  subtitle?: string;
}) {
  const { locale } = useI18n();
  const dict = chatTranslations[kind]?.[locale] || chatTranslations.messages[locale] || chatTranslations.messages.ru;
  const displayTitle = title || dict.title;
  const displaySubtitle = subtitle || dict.subtitle;

  return (
    <div
      className="messages-layout min-h-[460px] animate-pulse"
      role="status"
      aria-busy="true"
      aria-label={`${displayTitle} ${displaySubtitle}`}
    >
      <span className="sr-only">{displaySubtitle}</span>
      {/* Left sidebar skeleton */}
      <div className="surface-card messages-index space-y-4">
        <div className="h-6 w-36 rounded bg-[var(--line-strong)] opacity-60" />
        <div className="h-10 w-full rounded bg-[var(--sidebar)]" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="relative flex items-center gap-3 p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)]"
            >
              <div className="relative h-11 w-11 flex-shrink-0 rounded-full bg-[var(--line-strong)] opacity-50">
                <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface)] bg-[var(--accent)]" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-3/5 rounded bg-[var(--line-strong)] opacity-60" />
                <div className="h-3 w-4/5 rounded bg-[var(--line)] opacity-80" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right conversation skeleton */}
      <div className="surface-card conversation-panel flex flex-col justify-between min-h-[480px]">
        <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
          <div className="h-11 w-11 rounded-full bg-[var(--line-strong)] opacity-50" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-44 rounded bg-[var(--line-strong)] opacity-60" />
            <div className="h-3 w-28 rounded bg-[var(--line)] opacity-70" />
          </div>
        </div>

        <div className="my-6 space-y-4 flex-1">
          {/* Incoming message skeleton */}
          <div className="relative flex max-w-sm gap-2.5 p-3 rounded-2xl rounded-bl-sm border border-[var(--line)] bg-[var(--surface)]">
            <div className="h-8 w-8 rounded-full bg-[var(--line-strong)] opacity-40 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 rounded bg-[var(--line-strong)] opacity-50" />
              <div className="h-3 w-full rounded bg-[var(--line)] opacity-70" />
            </div>
          </div>

          {/* Outgoing message skeleton */}
          <div className="ml-auto flex max-w-sm gap-2.5 p-3 rounded-2xl rounded-br-sm border border-[var(--line-strong)] bg-color-mix(in srgb, var(--accent) 12%, var(--surface))">
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 ml-auto rounded bg-[var(--accent)] opacity-40" />
              <div className="h-3 w-5/6 ml-auto rounded bg-[var(--line-strong)] opacity-50" />
            </div>
          </div>

          {/* Incoming message skeleton 2 */}
          <div className="relative flex max-w-sm gap-2.5 p-3 rounded-2xl rounded-bl-sm border border-[var(--line)] bg-[var(--surface)]">
            <div className="h-8 w-8 rounded-full bg-[var(--line-strong)] opacity-40 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/2 rounded bg-[var(--line-strong)] opacity-50" />
              <div className="h-3 w-4/5 rounded bg-[var(--line)] opacity-70" />
            </div>
          </div>
        </div>

        {/* Input bar skeleton */}
        <div className="flex items-center gap-3 border-t border-[var(--line)] pt-4">
          <div className="h-11 flex-1 rounded-md bg-[var(--line)] opacity-40" />
          <div className="h-11 w-24 rounded-md bg-[var(--accent)] opacity-40" />
        </div>
      </div>
    </div>
  );
}

/**
 * Loader 2: Card Shimmer Loader
 * Based on Uiverse.io by Shoh2008
 */
export function CardShimmerLoader({
  count = 6,
  kind = "default",
  title,
}: {
  count?: number;
  kind?: "library" | "profile" | "default";
  title?: string;
}) {
  const { locale } = useI18n();
  const displayTitle = title || cardTranslations[kind]?.[locale] || cardTranslations.default[locale] || cardTranslations.default.ru;

  return (
    <div
      className="my-8"
      role="status"
      aria-busy="true"
      aria-label={displayTitle}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="h-6 w-48 rounded bg-[var(--line-strong)] opacity-50 animate-pulse" />
        <div className="h-4 w-28 rounded bg-[var(--line)] opacity-60 animate-pulse" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="uiverse-card-shimmer border border-[var(--line)] bg-[var(--surface)] p-6 rounded-lg shadow-sm"
          >
            <div className="shimmer-canvas" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Loader 3: Mechanical Pencil Study Loader
 * Based on Uiverse.io by gustavofusco
 */
export function PencilStudyLoader({
  kind = "default",
  title,
  caption,
}: {
  kind?: "hub" | "schedule" | "diary" | "reader" | "default";
  title?: string;
  caption?: string;
}) {
  const { locale } = useI18n();
  const dict = pencilTranslations[kind]?.[locale] || pencilTranslations.default[locale] || pencilTranslations.default.ru;
  const displayTitle = title || dict.title;
  const displayCaption = caption || dict.caption;

  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-4 text-center surface-card my-8"
      role="status"
      aria-busy="true"
      aria-label={displayTitle}
    >
      <div className="pencil-container mb-4">
        <svg
          className="pencil"
          viewBox="0 0 200 200"
          width="160"
          height="160"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <clipPath id="pencil-eraser-clip">
              <rect rx="5" ry="5" width="30" height="30" />
            </clipPath>
          </defs>
          <circle
            className="pencil__stroke"
            r="70"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="439.82 439.82"
            strokeDashoffset="439.82"
            strokeLinecap="round"
            transform="rotate(-113,100,100)"
          />
          <g className="pencil__rotate" transform="translate(100,100)">
            <g fill="none">
              <circle
                className="pencil__body1"
                r="64"
                stroke="var(--accent)"
                strokeWidth="30"
                strokeDasharray="402.12 402.12"
                strokeDashoffset="402"
                transform="rotate(-90)"
              />
              <circle
                className="pencil__body2"
                r="74"
                stroke="var(--bronze)"
                strokeWidth="10"
                strokeDasharray="464.96 464.96"
                strokeDashoffset="465"
                transform="rotate(-90)"
              />
              <circle
                className="pencil__body3"
                r="54"
                stroke="var(--ornament-green)"
                strokeWidth="10"
                strokeDasharray="339.29 339.29"
                strokeDashoffset="339"
                transform="rotate(-90)"
              />
            </g>
            <g className="pencil__eraser" transform="rotate(-90) translate(49,0)">
              <g className="pencil__eraser-skew">
                <rect fill="var(--bronze)" rx="5" ry="5" width="30" height="30" />
                <rect
                  fill="var(--accent-dark)"
                  width="5"
                  height="30"
                  clipPath="url(#pencil-eraser-clip)"
                />
                <rect fill="var(--surface)" width="30" height="20" />
                <rect fill="var(--line-strong)" width="15" height="20" />
                <rect fill="var(--line)" width="5" height="20" />
                <rect fill="rgba(0,0,0,0.18)" y="6" width="30" height="2" />
                <rect fill="rgba(0,0,0,0.18)" y="13" width="30" height="2" />
              </g>
            </g>
            <g className="pencil__point" transform="rotate(-90) translate(49,-30)">
              <polygon fill="#d8b278" points="15 0,30 30,0 30" />
              <polygon fill="#bc894c" points="15 0,6 30,0 30" />
              <polygon fill="var(--ink)" points="15 0,20 10,10 10" />
            </g>
          </g>
        </svg>
      </div>

      <h3 className="section-title text-xl text-[var(--accent)] font-semibold mt-2">
        {displayTitle}
      </h3>
      <p className="text-sm text-[var(--muted)] mt-1 max-w-sm">
        {displayCaption}
      </p>
    </div>
  );
}
