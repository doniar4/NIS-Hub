export type Subject = {
  id: string;
  name: string;
  shortName: string;
};

export type ClassOption = {
  id: string;
  name: string;
};

export type ScheduleLesson = {
  order: number;
  subject: string;
  room?: string;
  teacher?: string;
};

export const subjects: Subject[] = [
  { id: "mathematics", name: "Mathematics", shortName: "Math" },
  { id: "physics", name: "Physics", shortName: "Physics" },
  { id: "chemistry", name: "Chemistry", shortName: "Chem" },
  { id: "informatics", name: "Informatics", shortName: "Info" },
  { id: "history", name: "History", shortName: "History" },
  { id: "english", name: "English", shortName: "English" },
];

export const classOptions: ClassOption[] = [
  { id: "10f", name: "10F" },
  { id: "10g", name: "10G" },
  { id: "10h", name: "10H" },
];

// This is deliberately test data, not a real school timetable.
export const testSchedule: ScheduleLesson[] = [
  { order: 1, subject: "Mathematics", room: "—" },
  { order: 2, subject: "Physics", room: "—" },
  { order: 3, subject: "English", room: "—" },
  { order: 4, subject: "Informatics", room: "—" },
];

export const readerPages = [
  {
    title: "Проверка интерфейса",
    body: "Это собственный технический документ NIS Library. Он существует только для проверки навигации reader до подключения разрешённых материалов и PDF-хранилища.",
  },
  {
    title: "Граница демо-версии",
    body: "В этом прототипе нет опубликованных учебников. Не загружайте материалы, пока права на распространение не проверены и не задокументированы.",
  },
  {
    title: "Следующий шаг",
    body: "После подключения Supabase reader должен получать только разрешённые файлы из защищённого хранилища и сохранять позицию чтения в профиле пользователя.",
  },
];
