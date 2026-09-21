export type SourceReference = { id: string; name: string; short: string };
export type EduPagePublication = { number: string; year: number; label: string; effectiveFrom: string; effectiveTo: string | null };
export type SourceLesson = {
  sourceClass: string; sourceSubject: string;
  weekday: number; lesson_start: number; lesson_end: number;
  start_time: string; end_time: string; rooms: string[]; teachers: string[];
  groups: string[]; entireClass: boolean;
  subgroup_key: string; subgroup_label: string | null; audience: string;
};
export type EduPageSnapshot = {
  publication: EduPagePublication;
  classes: SourceReference[]; subjects: SourceReference[]; lessons: SourceLesson[];
  counts: { classes: number; subjectDefinitions: number; lessonDefinitions: number; cards: number; classLessons: number; nonClassCards: number };
};
export type EduPageDiscovery = { year: number; signature: string };
