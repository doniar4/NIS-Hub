import { SiteShell } from "@/components/site-shell";
import { HubSkeletonLoader } from "@/components/loaders/contextual-loaders";

export default function RootLoading() {
  return (
    <SiteShell>
      <HubSkeletonLoader />
    </SiteShell>
  );
}
