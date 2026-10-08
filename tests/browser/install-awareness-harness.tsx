// Real feature components, locale provider and stylesheet. Only the framework
// routing boundary is substituted by the browser test; no auth bypass/data.
import { createRoot } from "react-dom/client";
import { usePathname } from "next/navigation";
import { LocaleProvider } from "../../src/components/locale-provider";
import { InstallProvider } from "../../src/components/install-provider";
import {
  InstallHomeCard,
  InstallProfileEntry,
  InstallReminder,
} from "../../src/components/install-discovery";
import type { Locale } from "../../src/lib/i18n";

function Routes() {
  const path = usePathname();
  return (
    <main
      className="app-main"
      style={{ maxWidth: 900, margin: "auto", padding: 16 }}
    >
      <nav aria-label="Test routes">
        {["/", "/profile", "/schedule", "/admin", "/books/demo/read"].map(
          (route) => (
            <a
              key={route}
              href={route}
              onClick={(e) => {
                e.preventDefault();
                history.pushState(null, "", route + location.search);
                dispatchEvent(new Event("popstate"));
              }}
              style={{ marginInlineEnd: 12 }}
            >
              {route}
            </a>
          ),
        )}
      </nav>
      <h1>NIS Hub</h1>
      <InstallReminder />
      {path === "/" && <InstallHomeCard />}
      {path === "/profile" && <InstallProfileEntry />}
      <p>Installation awareness component integration test.</p>
    </main>
  );
}
const locale = new URLSearchParams(location.search).get("locale");
document.documentElement.dataset.theme =
  new URLSearchParams(location.search).get("theme") ?? "light";
const safeLocale: Locale = locale === "kk" || locale === "en" ? locale : "ru";
createRoot(document.getElementById("root")!).render(
  <LocaleProvider locale={safeLocale}>
    <InstallProvider>
      <Routes />
    </InstallProvider>
  </LocaleProvider>,
);
