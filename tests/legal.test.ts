import test from "node:test";
import assert from "node:assert/strict";
import { legalCopy } from "../src/lib/legal-copy";
test("all legal drafts contain current services, storage, persistence, operator and effective-date placeholders", () => {
  for (const copy of Object.values(legalCopy)) {
    assert.equal(copy.privacy.length, 11); assert.equal(copy.terms.length, 10);
    const privacy = copy.privacy.flat().join(" ");
    for (const term of ["Gemini", "18+", "400", "Telegram", "nis-sidebar", "Supabase", "Auth", "Storage", "<uid>/avatar.webp", "Top 4", "nis-theme", "nis-locale", "localStorage", "EMAIL"]) assert.ok(privacy.includes(term), term);
    assert.ok(copy.revision.includes("["));
    for (const [heading, body] of [...copy.privacy, ...copy.terms]) { assert.ok(heading); assert.ok(body.length > 50); }
  }
});
