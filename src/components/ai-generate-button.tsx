"use client";
import { ArrowRightIcon, MagicWandIcon } from "@radix-ui/react-icons";
import { HalftoneAccent } from "./ui/halftone-accent";

export function AiGenerateButton({
  pending,
  label,
  disabled = false,
}: {
  pending: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="ai-btn-frame">
      <button
        type="submit"
        className="button ai-study-action-btn"
        disabled={pending || disabled}
        aria-busy={pending}
      >
        <HalftoneAccent paused={pending || disabled} />
        <MagicWandIcon className="ai-wand-icon" aria-hidden="true" />
        <span className="ai-btn-label">{label}</span>
        {!pending && (
          <ArrowRightIcon className="study-submit-arrow" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
