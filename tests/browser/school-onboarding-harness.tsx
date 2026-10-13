import { BrandMark } from "../../src/components/brand";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { LocaleProvider } from "../../src/components/locale-provider";
import { SchoolOnboarding } from "../../src/components/school-onboarding";
import { SchoolSettings } from "../../src/components/school-settings";
import { ProfileForm } from "../../src/components/profile-form";
import { schoolCopy } from "../../src/lib/school-copy";
import type { Profile, ClassRow, SubjectRow } from "../../src/lib/database.types";

declare global { interface Window { schoolFixture: { profile: Profile; classes: ClassRow[]; subjects: SubjectRow[]; top: string[] }; } }
function Harness() {
  const f = window.schoolFixture;
  const query = new URLSearchParams(location.search);
  const [locale, setLocale] = useState<"ru" | "kk" | "en">(query.get("locale") === "kk" ? "kk" : query.get("locale") === "en" ? "en" : "ru");
  return <LocaleProvider locale={locale}><div className="public-experience onboarding-experience">
    <header className="fixture-header public-header"><span className="public-brand"><BrandMark /></span><button onClick={() => setLocale("ru")}>RU</button><button onClick={() => setLocale("kk")}>KZ</button><button onClick={() => setLocale("en")}>EN</button></header>
    {location.pathname === "/onboarding" ? <SchoolOnboarding {...f} /> : location.pathname === "/profile" ? <main className="school-onboarding">
      <SchoolSettings schoolId={f.profile.school_id} hasClass={!!f.profile.class_id} />
      <ProfileForm profile={f.profile} classes={f.classes.filter(c => c.school_id === f.profile.school_id)} subjects={f.subjects} top={f.top} hasAvatar={false} classHint={schoolCopy(locale).noClasses} />
    </main> : <p className="fixture-complete">Setup complete: {f.profile.display_name}</p>}
  </div></LocaleProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
