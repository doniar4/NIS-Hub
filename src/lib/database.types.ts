export type Profile = { id: string; display_name: string | null; class_id: string | null; avatar_path: string | null; bio: string | null; role: "student" | "admin"; created_at: string; updated_at: string };
export type ClassRow = { id: string; name: string; grade: number | null; section: string | null; created_at: string };
export type SubjectRow = { id: string; name: string; name_kz: string | null; name_en: string | null; short_name: string | null; created_at: string };
export type Book = { id: string; title: string; subject_id: string; class_id: string | null; author: string | null; publisher: string | null; publication_year: number | null; language: string | null; cover_path: string | null; file_path: string; page_count: number | null; license_status: "pending_review" | "approved" | "restricted"; publication_status: "draft" | "published" | "archived"; created_at: string; updated_at: string };
export type Bookmark = { id: string; profile_id: string; book_id: string; page_number: number; created_at: string };
export type Progress = { profile_id: string; book_id: string; page_number: number; updated_at: string };
export type Lesson = { id: string; class_id: string; date: string; lesson_number: number; subject_id: string; teacher: string | null; room: string | null; created_at: string };
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row, Required extends keyof Row> = { Row: Row; Insert: Pick<Row, Required> & Partial<Row>; Update: Partial<Row>; Relationships: [] };
// Matches schema.sql + migrations/202609100001_phase2.sql. Regenerate from the
// owner's Supabase project after applying migrations; no cloud schema is assumed.
export type Database = { public: {
  Tables: {
    profiles: Table<Profile, "id">;
    classes: Table<ClassRow, "name">;
    subjects: Table<SubjectRow, "name">;
    books: Table<Book, "title" | "subject_id" | "file_path">;
    bookmarks: Table<Bookmark, "profile_id" | "book_id" | "page_number">;
    reading_progress: Table<Progress, "profile_id" | "book_id" | "page_number">;
    schedule: Table<Lesson, "class_id" | "date" | "lesson_number" | "subject_id">;
    profile_top_subjects: Table<{ profile_id: string; subject_id: string; position: number }, "profile_id" | "subject_id" | "position">;
    book_rights: Table<{ book_id: string; source: string; permission_note: string }, "book_id" | "source" | "permission_note">;
  };
  Views: Record<string, never>;
  Functions: {
    is_admin: { Args: Record<string, never>; Returns: boolean };
    save_profile: { Args: { p_name: string; p_class: string | null; p_subjects: string[] }; Returns: undefined };
    save_book: { Args: { p_book: Json; p_source: string; p_note: string }; Returns: string };
  };
  Enums: { profile_role: "student" | "admin"; book_publication_status: Book["publication_status"]; book_license_status: Book["license_status"] };
  CompositeTypes: Record<string, never>;
} };
