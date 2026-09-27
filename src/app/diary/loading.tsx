import { SiteShell } from "@/components/site-shell";
import { DiarySkeletonLoader } from "@/components/loaders/contextual-loaders";

export default function DiaryLoading() {
  return (
    <SiteShell>
      <DiarySkeletonLoader />
    </SiteShell>
  );
}
