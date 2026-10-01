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
    void recordUserActivity(pathname, ua);
  }, [pathname]);

  return null;
}
