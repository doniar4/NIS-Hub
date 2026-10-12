"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { recordUserActivity } from "@/app/actions/activity";
import { ACTIVITY_RECORDED_EVENT, activityDate } from "@/lib/activity-date";

export function ActivityTracker() {
  const pathname = usePathname();
  const lastRecorded = useRef({ path: "", time: 0, day: "" });
  useEffect(() => {
    const record = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now(),
        day = activityDate();
      if (
        lastRecorded.current.path === pathname &&
        lastRecorded.current.day === day &&
        now - lastRecorded.current.time < 60000
      )
        return;
      lastRecorded.current = { path: pathname, time: now, day };
      void recordUserActivity(pathname, navigator.userAgent)
        .then((result) => {
          if (result.ok)
            window.dispatchEvent(new Event(ACTIVITY_RECORDED_EVENT));
        })
        .catch(() => undefined);
    };
    record();
    const midnight = () => {
      if (lastRecorded.current.day !== activityDate()) record();
    };
    // Count a visit when returning to the tab; a visible tab spanning midnight
    // starts the next local day without recording idle pings every minute.
    window.addEventListener("focus", record);
    document.addEventListener("visibilitychange", record);
    const timer = window.setInterval(midnight, 60000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", record);
      document.removeEventListener("visibilitychange", record);
    };
  }, [pathname]);
  return null;
}
