import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AppFrame } from "../../src/components/app-frame";
import { LocaleProvider } from "../../src/components/locale-provider";
import { ProfileActivity } from "../../src/components/profile-activity";
import { ProfilePortrait } from "../../src/components/profile-portrait";
import { ActivityTracker } from "../../src/components/activity-tracker";
import { PreferenceControls } from "../../src/components/preference-controls";
import {
  buildGrid,
  generateContributions,
  dayMs,
} from "../../src/components/ui/contribution-skyline";
import type { Locale } from "../../src/lib/i18n";

const today = "2026-10-12",
  start = dayMs(today);
// Fixture data is confined to this test harness; production always passes database rows.
const fixture = generateContributions(start, 17).map((day) => ({
  ...day,
  count:
    day.date === "2026-10-07"
      ? 0
      : day.date === "2026-10-07"
        ? 0
        : day.date >= "2026-10-08"
          ? day.date === "2026-10-12"
            ? 0
            : 2
          : day.count,
}));
const initial = {
  today,
  days: buildGrid(fixture, start, 1).cells.map(({ date, count }) => ({
    date,
    count,
  })),
};
function Harness() {
  const [locale, setLocale] = useState<Locale>("ru");
  useEffect(() => {
    const listener = (event: Event) =>
      setLocale((event as CustomEvent<Locale>).detail);
    window.addEventListener("profile-test-locale", listener);
    return () => window.removeEventListener("profile-test-locale", listener);
  }, []);
  return (
    <LocaleProvider locale={locale}>
      <AppFrame
        preferences={
          <PreferenceControls
            localeAction={async () => ({ ok: true })}
            localeFirst
          />
        }
        account={null}
        avatar={null}
      >
        <ActivityTracker />
        <div className="profile-heading surface-card">
          <ProfilePortrait name="Айдана Нұрланқызы" url={null} />
          <div>
            <h1 className="section-title">Айдана Нұрланқызы</h1>
            <p className="profile-class">11 A</p>
          </div>
        </div>
        <ProfileActivity
          initial={
            new URLSearchParams(location.search).has("unavailable")
              ? null
              : initial
          }
        />
        <section id="profile-tasks" className="surface-card">
          <h2 className="section-title">Мои задачи</h2>
          <p>Повторить материал по биологии.</p>
        </section>
      </AppFrame>
    </LocaleProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
