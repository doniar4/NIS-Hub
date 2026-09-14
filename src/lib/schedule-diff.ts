import type { WeeklyLesson } from "./database.types";
import { normalizeRoom } from "./catalog";
export type LessonSnapshot = Pick<WeeklyLesson,"id"|"class_id"|"weekday"|"lesson_start"|"lesson_end"|"start_time"|"end_time"|"subject_id"|"teacher"|"room"|"effective_from"|"effective_to">;
export function scheduleDiff(before: LessonSnapshot[], after: LessonSnapshot[]) {
  const key=(row:LessonSnapshot)=>[row.class_id,row.weekday,row.lesson_start,row.effective_from??""].join("/");
  const old=new Map(before.map(row=>[key(row),row])), current=new Map(after.map(row=>[key(row),row]));
  const added=after.filter(row=>!old.has(key(row))), removed=before.filter(row=>!current.has(key(row)));
  const changed=after.flatMap(row=>{
    const previous=old.get(key(row)); if(!previous)return [];
    const fields: ("subject"|"time"|"room"|"block")[]=[];
    if(row.subject_id!==previous.subject_id)fields.push("subject");
    if(row.start_time?.slice(0,5)!==previous.start_time?.slice(0,5)||row.end_time?.slice(0,5)!==previous.end_time?.slice(0,5))fields.push("time");
    if(normalizeRoom(row.room)!==normalizeRoom(previous.room))fields.push("room");
    if(row.lesson_end!==previous.lesson_end||row.effective_to!==previous.effective_to||row.teacher!==previous.teacher)fields.push("block");
    return fields.length?[{before:previous,after:row,fields}]:[];
  });
  return {added,removed,changed};
}
