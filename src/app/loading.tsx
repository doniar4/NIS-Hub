import { SiteShell } from "@/components/site-shell";
import { PencilStudyLoader } from "@/components/loaders/contextual-loaders";

export default function RootLoading() {
  return (
    <SiteShell>
      <PencilStudyLoader kind="hub" />
    </SiteShell>
  );
}
