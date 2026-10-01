// Test-only composition of production shell and messages with safe fixture identities.
import { createRoot } from "react-dom/client";
import { AppFrame } from "../../src/components/app-frame";
import { LocaleProvider } from "../../src/components/locale-provider";
import { MessagesPanel } from "../../src/components/messages-panel";

createRoot(document.getElementById("root")!).render(
  <LocaleProvider locale="ru">
    <AppFrame preferences={null} account={null} avatar={null}>
      <MessagesPanel userId="00000000-0000-4000-8000-000000000001" />
    </AppFrame>
  </LocaleProvider>,
);
