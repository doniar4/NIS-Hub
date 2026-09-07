# Instructions for Codex

You are implementing NIS Library as a real software project, not generating a landing-page mockup.

## Priority order
1. Correctness
2. Maintainability
3. Accessibility
4. Security
5. Minimal visual design
6. Feature completeness

## Do not
- Generate fake metrics.
- Generate fake reviews.
- Generate fake users.
- Generate fake school endorsements.
- Invent book metadata.
- Invent copyright permissions.
- Use AI-generated stock/student photographs.
- Use purple gradients.
- Use glassmorphism.
- Use pill-shaped buttons as the default control style.
- Add cursor-following effects.
- Add excessive scroll animations.
- Add emoji as primary UI icons.
- Add vague marketing copy.
- Add unsupported claims.
- Add unnecessary third-party trackers.
- Add unnecessary third-party embeds.
- Hard-code secrets.
- Expose service-role credentials to the browser.
- Disable security controls merely to make development easier.

## Engineering approach
- Use TypeScript strictly.
- Keep components small and reusable.
- Prefer semantic HTML.
- Keep server/client boundaries intentional.
- Validate user input.
- Handle loading, empty, error, and success states.
- Do not silently swallow errors.
- Add comments only where they explain non-obvious decisions.
- Do not rewrite unrelated code.
- Before changing an existing feature, inspect the current implementation.
- After each substantial feature, run lint/type checks/build.
- Never claim a feature works without testing it.

## Suggested stack
- Next.js
- TypeScript
- Tailwind CSS
- Supabase for PostgreSQL/Auth/Storage
- Vercel for deployment
- Git/GitHub

If the repository already has a different stack, do not migrate it without explicit instruction.

## Data model
Initial entities:
- profiles
- classes
- subjects
- books
- bookmarks
- schedule

Recommended relationships and fields are documented in docs/data-model.md.

## Authentication
Start with email/password authentication unless the repository already has another agreed provider.

## Storage
Use private/protected storage for book files unless a book is explicitly approved for public distribution.
Use a separate storage area for avatars.
Never expose privileged storage credentials.

## Legal
Create routes/pages for:
- /privacy
- /terms

Create a cookie policy only if the actual implementation uses cookies/tracking that makes one necessary.
Do not claim legal compliance. The project owner must obtain appropriate legal review for the applicable jurisdictions.

## Accessibility
The MVP must support:
- keyboard navigation
- visible focus states
- semantic headings
- labels for form fields
- descriptive button labels
- meaningful alt text
- empty alt for decorative images
- sufficient text/background contrast
- error messages that are understandable without color alone

## First implementation boundary
Implement only the MVP defined in docs/mvp.md.
Do not implement friends, messaging, comments, public social feed, ratings, payments, AI tutor, or user file uploads in v0.1.
