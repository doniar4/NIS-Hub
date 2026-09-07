import { Button } from "@/components/ui/button";

/**
 * Temporary shell placeholder for stage 1 (project shell + design system).
 * The real home/dashboard content is implemented in a later stage
 * per docs/mvp.md section 1.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-semibold tracking-tight">NIS Hub</h1>
        <p className="mt-2 max-w-md text-base text-muted">
          Project shell is running. Home, library, and schedule are built in
          the next stages.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="primary">Primary action</Button>
        <Button variant="secondary">Secondary action</Button>
      </div>
    </main>
  );
}
