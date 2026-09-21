import type { WeeklyInput } from "../timetable-import";
import { lessonIdentity } from "./mapping";
import { audienceCells } from "./groups";
export function canonicalLesson(row:WeeklyInput) {
  const cells=audienceCells(row.audience);
  return {class_id:row.class_id,weekday:row.weekday,lesson_start:row.lesson_start,lesson_end:row.lesson_end,
    subject_id:row.subject_id,room:row.room||null,teacher:row.teacher||null,start_time:row.start_time?.slice(0,5)||null,
    end_time:row.end_time?.slice(0,5)||null,effective_from:row.effective_from||null,effective_to:row.effective_to||null,
    subgroup_key:row.subgroup_key??"",subgroup_label:row.subgroup_label??null,
    audience:cells?[...cells].sort((a,b)=>a-b):null};
}
export function eduPageDiff(before:WeeklyInput[],after:WeeklyInput[]) {
  // A multimap preserves older validity intervals sharing the same slot.
  const old=new Map<string,WeeklyInput[]>();
  for(const row of before){const key=lessonIdentity(row);old.set(key,[...(old.get(key)??[]),row]);}
  const added:WeeklyInput[]=[],changed:{before:WeeklyInput;after:WeeklyInput}[]=[],unchanged:WeeklyInput[]=[];
  for(const row of after){
    const candidates=old.get(lessonIdentity(row))??[];
    const same=candidates.findIndex(prev=>JSON.stringify(canonicalLesson(prev))===JSON.stringify(canonicalLesson(row)));
    if(same>=0){candidates.splice(same,1);unchanged.push(row);}
    else if(candidates.length)changed.push({before:candidates.shift()!,after:row});
    else added.push(row);
  }
  return {added,changed,removed:[...old.values()].flat(),unchanged};
}
