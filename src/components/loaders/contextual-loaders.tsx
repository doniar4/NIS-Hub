"use client";

import { useI18n } from "@/components/locale-provider";

/* ==========================================================================
   Clean Minimalist Animated Loader (Zero Fake Skeletons, Zero Pre-load Clutter)
   ========================================================================== */
export function SimpleAnimatedLoader({ label }: { label?: string }) {
  const { t } = useI18n();

  return (
    <div
      className="simple-loader-container"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="simple-spinner" aria-hidden="true">
        <svg viewBox="0 0 38 38" stroke="currentColor">
          <g fill="none" fillRule="evenodd">
            <g transform="translate(1 1)" strokeWidth="3">
              <circle strokeOpacity=".18" cx="18" cy="18" r="18" />
              <path d="M36 18c0-9.94-8.06-18-18-18">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 18 18"
                  to="360 18 18"
                  dur="0.85s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          </g>
        </svg>
      </div>
      <span className="simple-loader-label">{label || t.loading}</span>
    </div>
  );
}

/* ==========================================================================
   Exported loader aliases for app page loading boundaries
   ========================================================================== */
export function HubSkeletonLoader() {
  return <SimpleAnimatedLoader />;
}

export function ScheduleSkeletonLoader() {
  return <SimpleAnimatedLoader />;
}

export function DiarySkeletonLoader() {
  return <SimpleAnimatedLoader />;
}

export function ReaderSkeletonLoader() {
  return <SimpleAnimatedLoader />;
}

export function LibrarySkeletonLoader() {
  return <SimpleAnimatedLoader />;
}

export function ProfileSkeletonLoader() {
  return <SimpleAnimatedLoader />;
}

export function ChatSkeletonLoader({ kind, label }: { kind?: string; label?: string } = {}) {
  return <SimpleAnimatedLoader />;
}

export function ContextualSkeletonLoader({
  module,
}: {
  module?: "hub" | "schedule" | "diary" | "reader" | "library" | "profile" | "chat";
}) {
  return <SimpleAnimatedLoader />;
}

export function PencilStudyLoader({
  label,
}: {
  kind?: string;
  title?: string;
  caption?: string;
  label?: string;
}) {
  return <SimpleAnimatedLoader label={label} />;
}
