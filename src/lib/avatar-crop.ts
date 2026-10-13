/** Source coordinates shared by preview and exported crop. */
export function avatarCrop(width: number, height: number, zoom: number, x: number, y: number) {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const size = Math.min(width, height) / clamp(zoom, 1, 4);
  return { size, left: (width - size) * (clamp(x, -1, 1) + 1) / 2, top: (height - size) * (clamp(y, -1, 1) + 1) / 2 };
}

export const AVATAR_EDITOR_LIMIT = 20 * 1024 * 1024;
