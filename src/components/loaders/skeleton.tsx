import type { CSSProperties, ReactNode } from "react";

/** Decorative primitive; put a single accessible status on its container. */
export function Skeleton({ width = "100%", height = "1rem", className = "" }: {
  width?: CSSProperties["width"]; height?: CSSProperties["height"]; className?: string;
}) {
  return <div aria-hidden="true" className={`nis-skeleton ${className}`} style={{ width, height }} />;
}

export function SkeletonRegion({ children, label, className = "" }: {
  children: ReactNode; label: string; className?: string;
}) {
  return <div className={`nis-skeleton-region ${className}`} role="status" aria-busy="true" aria-label={label}>
    <span className="sr-only">{label}</span><div aria-hidden="true">{children}</div>
  </div>;
}

export function SkeletonIntro() {
  return <div className="page-intro nis-skeleton-intro"><Skeleton width="5rem" height=".7rem" />
    <Skeleton width="min(70%, 24rem)" height="1.08em" className="page-title" />
    <div className="page-description"><Skeleton width="min(90%, 32rem)" /></div>
  </div>;
}

export function SkeletonPanel({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <div className={`surface-card nis-skeleton-panel ${className}`}>
    {children ?? <><Skeleton width="58%" height="1.5rem" /><Skeleton height="5rem" /><Skeleton width="38%" /></>}
  </div>;
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return <div>{Array.from({ length: count }, (_, index) => <div className="timetable-row lesson-row nis-skeleton-row" key={index}>
    <Skeleton width="4rem" height="2rem" /><Skeleton width="75%" height="2.5rem" />
  </div>)}</div>;
}

export function MaterialCardSkeleton() {
  return <div className="library-card nis-skeleton-panel p-6 h-full flex flex-col">
    <Skeleton width="46px" height="46px" className="nis-skeleton-motif" />
    <Skeleton width="40%" height=".75rem" />
    <Skeleton width="80%" height="1.56rem" />
    <Skeleton width="30%" height=".875rem" className="mt-3" />
    <div className="mt-auto pt-5 min-h-11"><Skeleton width="55%" height="1.5rem" /></div>
  </div>;
}
