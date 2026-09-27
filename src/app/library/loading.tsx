import { SiteShell } from "@/components/site-shell";
import { LibrarySkeletonLoader } from "@/components/loaders/contextual-loaders";

export default function LibraryLoading() {
  return (
    <SiteShell>
      <LibrarySkeletonLoader />
    </SiteShell>
  );
}
