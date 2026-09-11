import sharp from "sharp";

export const AVATAR_INPUT_LIMIT = 2 * 1024 * 1024;
export const AVATAR_OUTPUT_LIMIT = 256 * 1024;
const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };

export async function normalizeAvatar(file: File): Promise<Buffer> {
  if (!formats[file.type] || file.size < 1 || file.size > AVATAR_INPUT_LIMIT) throw new Error("Invalid avatar");
  const bytes = Buffer.from(await file.arrayBuffer());
  const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" });
  const metadata = await image.metadata();
  if (metadata.format !== formats[file.type] || (metadata.pages ?? 1) !== 1) throw new Error("Invalid avatar");
  // Auto-orient, crop to a bounded square, strip metadata, and encode actual WebP.
  const output = await image.rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
  if (output.length > AVATAR_OUTPUT_LIMIT) throw new Error("Invalid avatar");
  return output;
}

export async function persistAvatar(userId: string, bytes: Buffer, operations: {
  upload: (path: string, bytes: Buffer) => Promise<boolean>;
  savePath: (path: string) => Promise<boolean>;
}): Promise<"saved" | "uploadFailed" | "profileFailed"> {
  const path = `${userId}/avatar.webp`;
  try { if (!await operations.upload(path, bytes)) return "uploadFailed"; }
  catch { return "uploadFailed"; }
  // Never delete the canonical object on a later DB failure: it may replace an
  // existing avatar. Report the partial success; keep the current profile path.
  try { return await operations.savePath(path) ? "saved" : "profileFailed"; }
  catch { return "profileFailed"; }
}
