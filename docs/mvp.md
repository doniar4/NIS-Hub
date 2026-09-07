# NIS Library v0.1 MVP

## 1. Home
Purpose: quickly route a student to their library and today's schedule.

Content:
- NIS Library wordmark/name
- class selector/configuration
- today's schedule section
- continue reading section
- link to library
- link to profile

No hero marketing statement.

## 2. Library
Route: /library

Functions:
- display approved books
- filter by subject
- filter/search by title
- show class
- show language
- open book

States:
- loading
- empty
- error

## 3. Book page
Route: /books/[id]

Display:
- title
- subject
- class
- author
- publisher
- year
- language
- approved/publication status where appropriate
- open reader button

Do not invent missing metadata. Display only known values.

## 4. Reader
Route: /books/[id]/read

Minimum:
- PDF/document display
- page navigation if supported by selected viewer
- current page
- bookmark current page
- resume from last saved page

If a production PDF viewer is not practical in v0.1, implement a clean document viewer abstraction and a working test implementation rather than faking functionality.

## 5. Authentication
Routes:
- /login
- /signup

Functions:
- sign up
- sign in
- sign out
- protected profile actions

## 6. Profile
Route: /profile

Display:
- avatar
- display name
- class
- Top 4 subjects
- currently reading
- bookmarks

Editing:
- avatar
- display name
- class
- Top 4 subjects

## 7. Schedule
Route: /schedule

v0.1 uses database/test data.

Data:
- date
- lesson number
- subject
- teacher if available
- room if available
- class

Do NOT implement EduPage scraping until the source, access method, stability, terms, and permissions are verified.

## 8. Admin
Route: /admin

Minimum:
- protected admin access
- list books
- create/edit/delete books
- manage publication status
- manage subjects/classes

Do not expose admin functionality to ordinary users.

## 9. Legal pages
- /privacy
- /terms

Content should be a clearly marked project draft until reviewed for the actual operator, data practices, and applicable law.

## Explicitly out of scope
- social feed
- following/friends
- comments
- messages
- likes
- public rankings
- payments/refunds
- advertisements
- analytics unless explicitly required
- user-uploaded books
- AI features
