import { z } from "zod";
export const HIGHLIGHT_COLORS = {
  yellow: "rgba(250, 204, 21, 0.45)",
  green: "rgba(34, 197, 94, 0.4)",
  blue: "rgba(59, 130, 246, 0.4)",
  black: "rgba(15, 23, 42, 0.85)",
} as const;
export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;
export const highlightSchema = z
  .object({
    id: z.uuid(),
    page: z.number().int().min(1).max(100000),
    color: z.enum(["yellow", "green", "blue", "black"]),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    w: z.number().positive().max(100),
    h: z.number().positive().max(100),
  })
  .refine((h) => h.x + h.w <= 100.01 && h.y + h.h <= 100.01);
export type Highlight = z.infer<typeof highlightSchema>;
export function parseHighlights(value: unknown): Highlight[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const p = highlightSchema.safeParse(item);
        return p.success ? [p.data] : [];
      })
    : [];
}
