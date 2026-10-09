import type { Locale } from "./i18n";

const copy = {
  ru: {
    reminderTitle: "Заполните профиль",
    reminderBody: "Укажите имя и класс — тогда появится ваше расписание и одноклассники.",
    reminderAction: "Заполнить",
    later: "Позже",
    progress: "Профиль заполнен",
    stepName: "Имя",
    stepClass: "Класс",
    stepAvatar: "Фото",
    stepTop: "Top‑4",
    unsaved: "Есть несохранённые изменения",
    autosaving: "Сохраняем…",
    saved: "Сохранено",
    savedAuto: "Изменения сохраняются автоматически",
    save: "Сохранить",
    leaveWarning: "Изменения профиля не сохранены. Уйти со страницы?",
    tasks: "Мои задачи",
  },
  kk: {
    reminderTitle: "Профильді толтырыңыз",
    reminderBody: "Атыңыз бен сыныбыңызды көрсетіңіз — сонда кестеңіз бен сыныптастарыңыз көрінеді.",
    reminderAction: "Толтыру",
    later: "Кейін",
    progress: "Профиль толтырылды",
    stepName: "Аты",
    stepClass: "Сынып",
    stepAvatar: "Фото",
    stepTop: "Top‑4",
    unsaved: "Сақталмаған өзгерістер бар",
    autosaving: "Сақталуда…",
    saved: "Сақталды",
    savedAuto: "Өзгерістер автоматты түрде сақталады",
    save: "Сақтау",
    leaveWarning: "Профиль өзгерістері сақталмады. Беттен кетесіз бе?",
    tasks: "Менің тапсырмаларым",
  },
  en: {
    reminderTitle: "Complete your profile",
    reminderBody: "Add your name and class to see your schedule and classmates.",
    reminderAction: "Complete",
    later: "Later",
    progress: "Profile complete",
    stepName: "Name",
    stepClass: "Class",
    stepAvatar: "Photo",
    stepTop: "Top‑4",
    unsaved: "You have unsaved changes",
    autosaving: "Saving…",
    saved: "Saved",
    savedAuto: "Changes are saved automatically",
    save: "Save",
    leaveWarning: "Profile changes are not saved. Leave this page?",
    tasks: "My tasks",
  },
} as const;

export function profileCopy(locale: Locale) {
  return copy[locale] ?? copy.ru;
}

export function profileIsIncomplete(profile: { display_name: string | null; class_id: string | null } | null) {
  return !!profile && (!profile.display_name?.trim() || !profile.class_id);
}
