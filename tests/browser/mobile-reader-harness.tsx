// Test-only composition: production Reader with a local, non-private PDF fixture.
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "../../src/components/locale-provider";
import { PdfReader } from "../../src/components/pdf-reader";

const id = "00000000-0000-4000-8000-000000000030";

createRoot(document.getElementById("root")!).render(
  <LocaleProvider locale="ru">
    <main className="reader-main">
      <PdfReader bookId={id} variantId={id} initialPage={1} initialBookmarks={[]} />
    </main>
  </LocaleProvider>,
);
