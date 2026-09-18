"use client";

import { MagicWandIcon } from "@radix-ui/react-icons";

export function AiGenerateButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="ai-button-frame">
      <button type="submit" className="ai-generate-button" disabled={pending} aria-busy={pending}>
        <MagicWandIcon className="ai-button-icon" aria-hidden="true" />
        <span className="sr-only">{label}</span>
        <span className="ai-button-text" aria-hidden="true" key={label}>
          {Array.from(label).map((letter, index) => (
            <span className="ai-button-letter" key={index} style={{ animationDelay: `${index * 45}ms` }}>{letter}</span>
          ))}
        </span>
      </button>
    </div>
  );
}
