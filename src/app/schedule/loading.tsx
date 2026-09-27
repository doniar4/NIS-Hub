import { SiteShell } from "@/components/site-shell";
import { ScheduleSkeletonLoader } from "@/components/loaders/contextual-loaders";

export default function ScheduleLoading() {
  return (
    <SiteShell>
      <ScheduleSkeletonLoader />
    </SiteShell>
  );
}
