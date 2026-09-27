import { SiteShell } from "@/components/site-shell";
import { ProfileSkeletonLoader } from "@/components/loaders/contextual-loaders";

export default function ProfileLoading() {
  return (
    <SiteShell>
      <ProfileSkeletonLoader />
    </SiteShell>
  );
}
