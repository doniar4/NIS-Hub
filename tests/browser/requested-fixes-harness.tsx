import { createRoot } from "react-dom/client";
import { AppFrame } from "../../src/components/app-frame";
import { LocaleProvider } from "../../src/components/locale-provider";
import { PdfReader } from "../../src/components/pdf-reader";
import { ReaderWorkspace } from "../../src/components/reader-workspace";
import { AiStudyPanel } from "../../src/components/ai-study-panel";
import { MessagesPanel } from "../../src/components/messages-panel";

const id = "00000000-0000-4000-8000-000000000030";
const messages = new URLSearchParams(location.search).has("messages");
createRoot(document.getElementById("root")!).render(
  <LocaleProvider locale="ru">
    <AppFrame preferences={null} account={null} avatar={null}>
      {messages ? (
        <MessagesPanel userId="00000000-0000-4000-8000-000000000001" />
      ) : (
        <ReaderWorkspace
          information={<p>Fixture book</p>}
          inspector={
            <AiStudyPanel
              defaultOpen
              embedded
              variantId={id}
              totalPages={4}
              initialPage={1}
              config={{
                enabled: true,
                maxPages: 2,
                maxChars: 30000,
                dailyLimit: 10,
                sourceReady: true,
              }}
            />
          }
        >
          <PdfReader bookId={id} initialPage={1} initialBookmarks={[]} />
        </ReaderWorkspace>
      )}
    </AppFrame>
  </LocaleProvider>,
);
