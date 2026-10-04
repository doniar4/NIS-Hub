import { createRoot } from "react-dom/client";
import { LocaleProvider } from "../../src/components/locale-provider";
import { LibraryBrowser } from "../../src/components/library-browser";
import { PdfReader } from "../../src/components/pdf-reader";
import { changeLibrary } from "../../src/app/actions/library";
import type { LibraryPage } from "../../src/lib/library";
const page = (window as unknown as { fixturePage: LibraryPage }).fixturePage;
createRoot(document.getElementById("root")!).render(
  <LocaleProvider locale="en">
    <main style={{ padding: 24 }}>
      {location.pathname === "/reader" ? (
        <PdfReader
          bookId="00000000-0000-4000-8000-000000000030"
          initialPage={1}
          initialBookmarks={[]}
        />
      ) : (
        <LibraryBrowser
          mutateAction={changeLibrary}
          initial={{ q: "", grade: "", subject: "" }}
          page={page}
          personal={{ collections: [], history: [], recent: [] }}
          subjects={[]}
        />
      )}
    </main>
  </LocaleProvider>,
);
