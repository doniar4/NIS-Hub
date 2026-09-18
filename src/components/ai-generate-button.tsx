"use client";

export function AiGenerateButton({
  pending,
  label,
}: {
  pending: boolean;
  label: string;
}) {
  return (
    <div className="ai-btn-frame">
      <button
        type="submit"
        className="button ai-study-action-btn"
        disabled={pending}
        aria-busy={pending}
      >
        <svg
          className="ai-wand-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 4V2m0 16v-2m8-7h-2M4 11H2m15.5 4.5l-1.5-1.5m-8-8L6.5 4.5m10 0l-1.5 1.5m-8 8L5.5 15.5" />
          <path d="M10.5 8.5L3 16l5 5 7.5-7.5" />
          <path d="m14 10 3 3" />
        </svg>
        <span className="ai-btn-label">{label}</span>
      </button>
    </div>
  );
}

