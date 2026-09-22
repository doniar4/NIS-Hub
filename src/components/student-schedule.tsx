"use client";
import type {ComponentProps} from "react";
import {WeeklyScheduleBrowser} from "./weekly-schedule";
import {HomeworkPreview} from "./homework-preview";
import {ClassHomeworkPanel} from "./class-homework";
import {useI18n} from "./locale-provider";
import {designCopy} from "@/lib/design-copy";

export function StudentSchedule({userId,...props}:ComponentProps<typeof WeeklyScheduleBrowser>&{userId:string}) {
  const {locale}=useI18n();
  return <WeeklyScheduleBrowser {...props}
    homeworkPreview={date=><HomeworkPreview date={date} subjects={props.subjects} hasClass={!!props.initialClassId}/>}
    homeworkEditor={date=><details className="surface-card schedule-homework" id="homework">
      <summary>{designCopy(locale).homeworkFull}</summary>
      <ClassHomeworkPanel key={date} userId={userId} hasClass={!!props.initialClassId} date={date} subjects={props.subjects}/>
    </details>}/>;
}
