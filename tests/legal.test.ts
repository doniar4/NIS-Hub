import test from "node:test";
import assert from "node:assert/strict";
import { legalCopy } from "../src/lib/legal-copy";
test("production policies disclose real services, contacts and retention without invented deadlines", () => {
  for (const copy of Object.values(legalCopy)) {
    assert.equal(copy.privacy.length, 12); assert.equal(copy.terms.length, 8);
    const privacy = copy.privacy.flat().join(" ");
    for (const term of ["Gemini", "18+", "400", "Telegram", "nis-sidebar", "Supabase", "Auth", "Storage", "<uid>/avatar.webp", "Top 4", "nis-theme", "nis-locale", "localStorage", "sun97794546@gmail.com", "Есентаев Т.", "Vercel", "EduPage", "SMS"]) assert.ok(privacy.includes(term), term);
    assert.ok(!copy.revision.includes("["));
    assert.ok(!/beta|draft|черновик|INSERT|УКАЗАТЬ/i.test(JSON.stringify(copy)));
    for (const [heading, body] of [...copy.privacy, ...copy.terms]) { assert.ok(heading); assert.ok(body.length > 50); }
  }
});
