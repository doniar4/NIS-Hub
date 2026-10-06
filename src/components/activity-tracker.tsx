"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { recordUserActivity } from "@/app/actions/activity";

export function ActivityTracker() {
  const pathname = usePathname();
  const lastRecorded = useRef<{ path: string; time: number }>({ path: "", time: 0 });

  useEffect(() => {
    const now = Date.now();
    // Throttle calls: max once per minute unless path changes
    if (
      lastRecorded.current.path === pathname &&
      now - lastRecorded.current.time < 60_000
    ) {
      return;
    }

    lastRecorded.current = { path: pathname, time: now };
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    // Navigation can cancel this best-effort Server Action (notably WebKit).
    // A telemetry transport failure must not break the page or create an
    // unhandled rejection. Keep the existing throttle; do not retry in a loop.
    void recordUserActivity(pathname, ua).catch(() => undefined);
  }, [pathname]);

  return null;
}
