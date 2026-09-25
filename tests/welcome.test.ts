import test from "node:test";
import assert from "node:assert/strict";
import { isWelcomeComplete, WELCOME_COOKIE_MAX_AGE } from "../src/lib/welcome";

test("welcome persistence accepts only the explicit durable marker", () => {
  assert.equal(isWelcomeComplete("1"), true);
  for (const value of [undefined, null, "", "0", "true", 1]) {
    assert.equal(isWelcomeComplete(value), false);
  }
  assert.ok(WELCOME_COOKIE_MAX_AGE >= 60 * 60 * 24 * 365);
});
