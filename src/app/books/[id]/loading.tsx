import { SiteShell } from "@/components/site-shell";
import { ReaderSkeletonLoader } from "@/components/loaders/contextual-loaders";

export default function BookLoading() {
  return (
    <SiteShell>
      <ReaderSkeletonLoader />
    </SiteShell>
  );
}
