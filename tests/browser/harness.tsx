// Test-only entry. Bundled in memory and served by a loopback fixture server.
// No test routes, auth bypasses or fixtures are added to the Next application.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { LocaleProvider } from "../../src/components/locale-provider";
import { PreferenceControls } from "../../src/components/preference-controls";
import { LibraryBrowser } from "../../src/components/library-browser";
import { TopSubjects } from "../../src/components/top-subjects";
import { AvatarPreview } from "../../src/components/avatar-preview";
import { ScheduleImport } from "../../src/components/schedule-import";
import { initialLibraryFilters } from "../../src/lib/library";
import { parseLocale } from "../../src/lib/i18n";
import { books, classes, subjects } from "./fixtures";

function Harness() {
  const [locale, setLocale] = useState<"ru" | "kk" | "en">("en");
  const [imageUrl, setImageUrl] = useState("/avatar-expired.webp");
  const [submission, setSubmission] = useState("");
  const [initial, setInitial] = useState(() => initialLibraryFilters(Object.fromEntries(new URLSearchParams(location.search))));
  const controls = <PreferenceControls localeAction={async value => { const selected = parseLocale(value); setLocale(selected); document.documentElement.lang = selected; return { ok: true }; }}/>;
  return <LocaleProvider locale={locale}><main className="mx-auto max-w-6xl p-6"><h1 className="page-title mb-8">Phase 3 isolated component fixture</h1>{controls}
    {location.pathname === "/library" ? <>
      <button onClick={() => { history.replaceState(history.state, "", "/library"); setInitial({ q: "", grade: "", subject: "" }); }}>Simulate fresh route props</button>
      <LibraryBrowser key={JSON.stringify(initial)} initial={initial} books={books} classes={classes} subjects={subjects} truncated={false}/>
    </> : <>
      <form className="my-8" onSubmit={event => { event.preventDefault(); setSubmission(JSON.stringify(new FormData(event.currentTarget).getAll("subjects"))); }}>
        <TopSubjects subjects={subjects} initial={[subjects[0].id]}/><button className="button mt-5">Save Top 4 fixture</button>
      </form>
      <AvatarPreview key={imageUrl} url={imageUrl} onRetry={() => setImageUrl("/avatar-valid.webp")}/>
      <ScheduleImport classes={classes} subjects={subjects} action={async (_state, form) => { setSubmission(String(form.get("schedule_json"))); return { success: "Fixture accepted" }; }}/>
      <output data-testid="submission">{submission}</output>
    </>}
  </main></LocaleProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
