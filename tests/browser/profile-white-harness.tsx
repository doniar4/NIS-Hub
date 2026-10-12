import { createRoot } from "react-dom/client";
import { useState } from "react";
import { LocaleProvider } from "../../src/components/locale-provider";
import { ProfileForm } from "../../src/components/profile-form";
import { ThemeControl } from "../../src/components/theme-control";
const profile = (
  window as unknown as {
    fixtureProfile: { display_name: string; class_id: string; bio: string | null };
  }
).fixtureProfile;
function Harness() {
  const [locale, setLocale] = useState<"ru" | "kk">("ru");
  return (
    <LocaleProvider locale={locale}>
      <header style={{ display: "flex", gap: 16, padding: 16 }}>
        <ThemeControl />
        <button onClick={() => setLocale("ru")}>RU</button>
        <button onClick={() => setLocale("kk")}>KZ</button>
      </header>
      <main style={{ padding: 16, maxWidth: 760, margin: "auto" }}>
        <ProfileForm
          profile={profile}
          classes={[{ id: profile.class_id, name: "9A" }]}
          subjects={[]}
          top={[]}
          hasAvatar={false}
        />
      </main>
    </LocaleProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
