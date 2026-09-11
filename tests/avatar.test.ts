import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizeAvatar, persistAvatar, AVATAR_INPUT_LIMIT } from "../src/lib/avatar";

test("avatar decodes allowed formats and emits metadata-free 256px WebP", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const bytes = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#abcd12" } }).toFormat(format).toBuffer();
    const output = await normalizeAvatar(new File([new Uint8Array(bytes)], "untrusted-name.any", { type: `image/${format}` }));
    const info = await sharp(output).metadata();
    assert.equal(info.format, "webp"); assert.equal(info.width, 256); assert.equal(info.height, 256);
    assert.equal(info.exif, undefined); assert.equal(info.icc, undefined);
  }
});
test("avatar rejects unsupported, spoofed, corrupt, empty, oversized and excessive-pixel inputs", async () => {
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
  for (const file of [
    new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }),
    new File([new Uint8Array(png)], "x.jpg", { type: "image/jpeg" }),
    new File(["not an image"], "x.webp", { type: "image/webp" }),
    new File([], "empty.png", { type: "image/png" }),
    new File([new Uint8Array(AVATAR_INPUT_LIMIT + 1)], "huge.png", { type: "image/png" }),
    new File([new Uint8Array(await sharp({ create: { width: 4001, height: 4001, channels: 3, background: "white" } }).png().toBuffer())], "pixels.png", { type: "image/png" }),
  ]) await assert.rejects(normalizeAvatar(file));
});
test("avatar overwrites one canonical object and saves profile only after successful upload", async () => {
  const objects = new Map<string, Buffer>(); const calls: string[] = [];
  const operations = {
    upload: async (path: string, bytes: Buffer) => { objects.set(path, bytes); calls.push("upload"); return true; },
    savePath: async (path: string) => { assert.ok(objects.has(path)); calls.push(path); return true; },
  };
  for (let i = 0; i < 3; i++) assert.equal(await persistAvatar("user-id", Buffer.from([i]), operations), "saved");
  assert.deepEqual([...objects.keys()], ["user-id/avatar.webp"]); assert.equal(objects.size, 1);
  assert.equal(await persistAvatar("user-id", Buffer.alloc(0), { ...operations, upload: async () => false }), "uploadFailed");
  assert.equal(calls.length, 6);
  assert.equal(await persistAvatar("user-id", Buffer.from([9]), { ...operations, savePath: async () => false }), "profileFailed");
  assert.equal(objects.get("user-id/avatar.webp")![0], 9);
});
