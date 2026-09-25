import type { SubjectRow } from "@/lib/database.types";

const glyphs: Record<string, string> = {
  math: "∑", mathematics: "∑", физика: "∿", physics: "∿",
  chemistry: "⚗", химия: "⚗", biology: "⌬", биология: "⌬",
  history: "⌛", история: "⌛", literature: "¶", литература: "¶",
  informatics: "⌘", информатика: "⌘",
};

export function SubjectVisual({ subject, hero = false }: { subject?: SubjectRow; hero?: boolean }) {
  const name = subject?.name ?? "";
  const glyph = Object.entries(glyphs).find(([key]) => name.toLocaleLowerCase().includes(key))?.[1] ?? "✦";
  return <div className={hero ? "subject-visual subject-visual-hero" : "subject-visual"} aria-hidden="true">
    <span className="subject-sheet subject-sheet-back"/>
    <span className="subject-sheet subject-sheet-mid"/>
    <span className="subject-sheet subject-sheet-front"><span>{glyph}</span></span>
    <span className="subject-orb"/>
  </div>;
}
