import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { LocaleProvider } from "../../src/components/locale-provider";
import { ReaderWorkspace } from "../../src/components/reader-workspace";
import { AiStudyPanel } from "../../src/components/ai-study-panel";
import type { Locale } from "../../src/lib/i18n";

function Harness() {
  const [locale, setLocale] = useState<Locale>("ru");
  useEffect(() => {
    const listener = (event: Event) =>
      setLocale((event as CustomEvent<Locale>).detail);
    window.addEventListener("study-test-locale", listener);
    return () => window.removeEventListener("study-test-locale", listener);
  }, []);
  return (
    <LocaleProvider locale={locale}>
      <main style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
        <ReaderWorkspace
          information={<p>Учебник биологии</p>}
          inspector={
            <AiStudyPanel
              embedded
              defaultOpen
              variantId="00000000-0000-4000-8000-000000000030"
              totalPages={80}
              initialPage={7}
              config={{
                enabled: true,
                maxPages: 10,
                maxChars: 30000,
                dailyLimit: 10,
                sourceReady: true,
              }}
            />
          }
        >
          <article
            style={{
              padding: "48px",
              background: "var(--surface)",
              minHeight: "700px",
              borderRadius: "12px",
            }}
          >
            <h1>Фотосинтез</h1>
            <p>Учебник биологии · Страница 7</p>
          </article>
        </ReaderWorkspace>
      </main>
    </LocaleProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
