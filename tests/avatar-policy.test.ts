import test from "node:test";
import assert from "node:assert/strict";
import { avatarCooldownRemaining, AVATAR_URL_TTL_SECONDS } from "../src/lib/avatar-policy";
test("avatar cooldown is bounded, timestamp-based and expires at60seconds", () => {
  const now = Date.parse("2026-09-12T10:00:00Z");
  for (const value of [null, undefined, "", "invalid"]) assert.equal(avatarCooldownRemaining(value, now), 0);
  assert.equal(avatarCooldownRemaining(new Date(now).toISOString(), now), 60);
  assert.equal(avatarCooldownRemaining(new Date(now - 30_001).toISOString(), now), 30);
  assert.equal(avatarCooldownRemaining(new Date(now - 60_000).toISOString(), now), 0);
  assert.equal(avatarCooldownRemaining(new Date(now + 5000).toISOString(), now), 60);
  assert.equal(AVATAR_URL_TTL_SECONDS, 60);
});
