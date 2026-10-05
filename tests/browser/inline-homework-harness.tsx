import { useState } from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "../../src/components/locale-provider";
import { StudentSchedule } from "../../src/components/student-schedule";
import { HomeTimetable } from "../../src/components/home-timetable";
import { HomeworkPreview } from "../../src/components/homework-preview";
import { DayHomeworkProvider } from "../../src/components/day-homework-provider";
import { classes, subjects } from "./fixtures";
import type { WeeklyLesson } from "../../src/lib/database.types";

export const lessonFixtures: WeeklyLesson[] = [1, 2, 3, 4, 5].flatMap(weekday => [0, 1, 2].map(index => ({
  id: `lesson-${weekday}-${index}`, class_id: classes[0].id, weekday, lesson_start: index + 1, lesson_end: index + 1,
  start_time: "08:30", end_time: "09:10", subject_id: subjects[index].id, teacher: null, room: "246",
  effective_from: null, effective_to: null, created_at: "", updated_at: "",
})));

function Harness() {
  const params = new URLSearchParams(location.search);
  const locale = params.get("locale") === "ru" ? "ru" : params.get("locale") === "kk" ? "kk" : "en";
  const [date, setDate] = useState("2026-10-05");
  return <LocaleProvider locale={locale}><main style={{ padding: 16, maxWidth: 1280, margin: "auto" }}>
    {location.pathname === "/home" ? <DayHomeworkProvider date={date} classId={classes[0].id}>
      <HomeTimetable lessons={lessonFixtures} subjects={subjects} classId={classes[0].id} today="2026-10-05"
        selectedDate={date} onDateChange={setDate} nonSchoolDays={[]} grade={classes[0].grade}/>
      <HomeworkPreview date={date} subjects={subjects} hasClass/>
    </DayHomeworkProvider> : <StudentSchedule userId="fixture-user" lessons={[...lessonFixtures,...lessonFixtures.map(row=>({...row,id:row.id+"-other",class_id:classes[1].id}))]} subjects={subjects}
      classes={classes} initialClassId={classes[0].id} date="2026-10-05" nonSchoolDays={[]}/>}
  </main></LocaleProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
