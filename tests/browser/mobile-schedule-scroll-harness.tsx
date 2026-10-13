import { createRoot } from "react-dom/client";
import { AppFrame } from "../../src/components/app-frame";
import { LocaleProvider } from "../../src/components/locale-provider";
import { PreferenceControls } from "../../src/components/preference-controls";
import { ParallaxBackground } from "../../src/components/parallax-background";
import { SmoothScroll } from "../../src/components/smooth-scroll";
import { StudentSchedule } from "../../src/components/student-schedule";
import { classes, subjects } from "./fixtures";
import type { WeeklyLesson } from "../../src/lib/database.types";

// Only safe project fixtures; no authenticated session or production data.
const lessons: WeeklyLesson[] = [1, 2, 3, 4, 5].flatMap(weekday =>
  Array.from({ length: 12 }, (_, index) => ({
    id: `scroll-${weekday}-${index}`, class_id: classes[0].id, weekday,
    lesson_start: index + 1, lesson_end: index + 1,
    start_time: "08:30", end_time: "09:10", subject_id: subjects[index % subjects.length].id,
    teacher: null, room: "246", effective_from: null, effective_to: null, created_at: "", updated_at: "",
  })));

createRoot(document.getElementById("root")!).render(
  <LocaleProvider locale="en">
    <SmoothScroll /><ParallaxBackground />
    <AppFrame preferences={<PreferenceControls localeAction={async () => ({ ok: true })}/>}
      account={null} avatar={null}>
      <h1 className="page-title">Schedule</h1>
      <StudentSchedule userId="fixture-user" lessons={lessons} subjects={subjects} classes={classes}
        initialClassId={classes[0].id} date="2026-10-05" nonSchoolDays={[]}/>
    </AppFrame>
  </LocaleProvider>
);
