# First Prompt for Codex

Read all files in docs/ before changing code.

Build NIS Library v0.1 according to this repository specification.

Before writing code:
1. Inspect the repository.
2. Identify the current framework and package manager.
3. Explain the proposed implementation plan in concise bullets.
4. Identify anything that requires a decision or external credential.
5. Do not invent external integrations.

Then implement the MVP in small, testable stages.

Start with:
1. project shell and design system
2. home page
3. library page
4. book page
5. authentication
6. profile
7. Top 4
8. schedule with test/database data
9. admin book management
10. privacy and terms routes

Use realistic empty states instead of fake data where possible. If seed data is necessary for development, clearly label it as demo/test data and keep it out of production.

Do not implement EduPage scraping yet.

Do not add social feed, friends, comments, messages, ratings, analytics, payments, or user book uploads.

After each stage:
- run lint
- run typecheck if available
- run build
- report what changed
- report any unresolved issue

Do not mark a feature complete if it has not been tested.
