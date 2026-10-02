"use client";

import { useI18n } from "@/components/locale-provider";
import { MaterialCardSkeleton, Skeleton, SkeletonIntro, SkeletonPanel, SkeletonRegion, SkeletonRows } from "./skeleton";
import type { ReactNode } from "react";

function LoadingRegion({ children, label }: { children: ReactNode; label?: string }) {
  const { t } = useI18n();
  return <SkeletonRegion label={label ?? t.loading}>{children}</SkeletonRegion>;
}

/* ==========================================================================
   Compact activity indicator for operations without a known content layout
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
  return <LoadingRegion><SkeletonIntro /><div className="home-study-dashboard mt-8"><div className="dashboard-primary"><SkeletonPanel /><SkeletonPanel><SkeletonRows count={4} /></SkeletonPanel></div><div className="dashboard-secondary"><SkeletonPanel /><SkeletonPanel /><SkeletonPanel /></div></div></LoadingRegion>;
}

export function ScheduleSkeletonLoader() {
  return <LoadingRegion><SkeletonIntro /><div className="nis-skeleton-toolbar"><Skeleton height="3rem" /></div><div className="schedule-day-content"><SkeletonPanel><Skeleton width="55%" height="1.5rem" /><SkeletonRows /></SkeletonPanel><SkeletonPanel /></div></LoadingRegion>;
}

export function DiarySkeletonLoader() {
  return <LoadingRegion><SkeletonIntro /><div className="nis-skeleton-toolbar"><Skeleton height="3rem" /></div><div className="sms-subjects mt-5">{Array.from({ length:4 }, (_, i) => <SkeletonPanel key={i} className="sms-subject" />)}</div></LoadingRegion>;
}

export function ReaderSkeletonLoader() {
  return <LoadingRegion><SkeletonIntro /><div className="nis-skeleton-toolbar"><Skeleton height="2.75rem" /></div><div className="nis-skeleton-reader"><SkeletonPanel className="nis-skeleton-paper"><Skeleton width="65%" height="2rem" /><Skeleton height="65%" /></SkeletonPanel><SkeletonPanel /></div></LoadingRegion>;
}

export function LibrarySkeletonLoader({ count = 6 }: { count?: number } = {}) {
  return <LoadingRegion><SkeletonIntro /><div className="nis-skeleton-library-toggle"><Skeleton height="2.75rem" /></div><div className="nis-skeleton-toolbar nis-skeleton-library-filters"><Skeleton height="3.75rem" /></div><div className="my-5"><Skeleton width="6rem" height="1.25rem" /></div><div className="library-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length:count }, (_, i) => <MaterialCardSkeleton key={i} />)}</div></LoadingRegion>;
}

export function ProfileSkeletonLoader() {
  return <LoadingRegion><SkeletonPanel className="profile-heading"><Skeleton width="6rem" height="6rem" /><Skeleton width="45%" height="2rem" /></SkeletonPanel><div className="my-5"><Skeleton height="2.75rem" /></div><SkeletonPanel><Skeleton width="40%" height="1.5rem" /><Skeleton height="5rem" /></SkeletonPanel><div className="profile-settings"><SkeletonPanel><Skeleton height="3rem" /><Skeleton height="7rem" /><Skeleton height="3rem" /></SkeletonPanel><SkeletonPanel /></div><div className="profile-reading mt-8 grid gap-6 lg:grid-cols-2"><SkeletonPanel /><SkeletonPanel /></div></LoadingRegion>;
}

export function ChatSkeletonLoader({ kind, label }: { kind?: string; label?: string } = {}) {
  return <LoadingRegion label={label}>{kind === "support" ? <div className="mt-8"><SkeletonPanel><SkeletonRows count={3} /></SkeletonPanel></div> : <div className="messages-layout nis-skeleton-chat"><SkeletonPanel className="messages-index"><Skeleton height="2.75rem" /><SkeletonRows count={5} /></SkeletonPanel><SkeletonPanel className="conversation-panel nis-skeleton-conversation"><Skeleton width="45%" height="2rem" /><Skeleton height="3rem" /></SkeletonPanel></div>}</LoadingRegion>;
}

export function ContextualSkeletonLoader({
  module,
}: {
  module?: "hub" | "schedule" | "diary" | "reader" | "library" | "profile" | "chat";
} = {}) {
  const loaders = { hub:HubSkeletonLoader, schedule:ScheduleSkeletonLoader, diary:DiarySkeletonLoader, reader:ReaderSkeletonLoader, library:LibrarySkeletonLoader, profile:ProfileSkeletonLoader, chat:ChatSkeletonLoader };
  const Loader = loaders[module ?? "hub"];
  return <Loader />;
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
