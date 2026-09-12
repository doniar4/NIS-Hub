export type Profile = { id: string; display_name: string | null; class_id: string | null; avatar_path: string | null; bio: string | null; role: "student" | "admin"; created_at: string; updated_at: string };
export type ClassRow = { id: string; name: string; grade: number | null; section: string | null; created_at: string };
export type SubjectRow = { id: string; name: string; name_kz: string | null; name_en: string | null; short_name: string | null; created_at: string };
export type Book = { id: string; title: string; subject_id: string; class_id: string | null; author: string | null; publisher: string | null; publication_year: number | null; language: string | null; cover_path: string | null; file_path: string; page_count: number | null; publication_status: "draft" | "published" | "archived"; created_at: string; updated_at: string };
export type Bookmark = { id: string; profile_id: string; book_id: string; page_number: number; created_at: string };
export type Progress = { profile_id: string; book_id: string; page_number: number; updated_at: string };
export type Lesson = { id: string; class_id: string; date: string; lesson_number: number; subject_id: string; teacher: string | null; room: string | null; created_at: string };
export type WeeklyLesson = { id: string; class_id: string; weekday: number; lesson_start: number; lesson_end: number; start_time: string | null; end_time: string | null; subject_id: string; teacher: string | null; room: string | null; effective_from: string | null; effective_to: string | null; created_at: string; updated_at: string };
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row, Required extends keyof Row> = { Row: Row; Insert: Pick<Row, Required> & Partial<Row>; Update: Partial<Row>; Relationships: [] };
// Application types for schema.sql and migrations through Phase 4. Historical
// rights tables/enums are retained only for schema compatibility. Regenerate from the
// owner's Supabase project after applying migrations; no cloud schema is assumed.
export type Database = { public: {
  Tables: {
    profiles: Table<Profile, "id">;
    classes: Table<ClassRow, "name">;
    subjects: Table<SubjectRow, "name">;
    books: Table<Book, "title" | "subject_id" | "file_path">;
    bookmarks: Table<Bookmark, "profile_id" | "book_id" | "page_number">;
    reading_progress: Table<Progress, "profile_id" | "book_id" | "page_number">;
    weekly_schedule: Table<WeeklyLesson, "class_id" | "weekday" | "lesson_start" | "lesson_end" | "subject_id">;
    schedule: Table<Lesson, "class_id" | "date" | "lesson_number" | "subject_id">;
    profile_top_subjects: Table<{ profile_id: string; subject_id: string; position: number }, "profile_id" | "subject_id" | "position">;
    book_rights: Table<{ book_id: string; source: string; permission_note: string }, "book_id" | "source" | "permission_note">;
  };
  Views: Record<string, never>;
  Functions: {
    is_admin: { Args: Record<string, never>; Returns: boolean };
    save_profile: { Args: { p_name: string; p_class: string | null; p_subjects: string[] }; Returns: undefined };
    import_weekly_schedule: { Args: { p_lessons: Json }; Returns: number };
    import_schedule: { Args: { p_lessons: Json }; Returns: number };
    save_book: { Args: { p_book: Json }; Returns: string };
  };
  Enums: { profile_role: "student" | "admin"; book_publication_status: Book["publication_status"]; book_license_status: "pending_review" | "approved" | "restricted" };
  CompositeTypes: Record<string, never>;
} };
