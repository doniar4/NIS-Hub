# Initial Data Model

## profiles
- id UUID, references authenticated user
- username nullable/unique if implemented
- display_name
- avatar_path nullable
- class_id nullable
- bio nullable
- created_at
- updated_at

## classes
- id
- name
- grade
- section
- created_at

## subjects
- id
- name
- name_kz nullable
- name_en nullable
- short_name nullable
- created_at

## books
- id
- title
- subject_id
- class_id
- author nullable
- publisher nullable
- year nullable
- language nullable
- cover_path nullable
- file_path
- license_status
- publication_status
- created_at
- updated_at

Suggested publication_status:
- draft
- published
- archived

Suggested license_status:
- pending_review
- approved
- restricted

Only approved content should be publicly readable.

## bookmarks
- id
- profile_id
- book_id
- page_number nullable
- created_at
- unique constraint where appropriate

## schedule
- id
- class_id
- date
- lesson_number
- subject_id
- teacher nullable
- room nullable
- created_at

## Top 4
Use a separate relation:
profile_top_subjects
- profile_id
- subject_id
- position 1..4
- unique(profile_id, position)
- unique(profile_id, subject_id)

## Security
Enable Row Level Security for user-owned data.
A user can read/update their own profile.
A user cannot modify another user's profile.
Ordinary users cannot create/edit/delete books.
Schedule editing is admin-only.
Book publication status is admin-only.
Storage policies must match these rules.
