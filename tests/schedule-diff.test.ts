import test from "node:test";
import assert from "node:assert/strict";
import { scheduleDiff, type LessonSnapshot } from "../src/lib/schedule-diff";
const row:LessonSnapshot={id:"a",class_id:"7A",weekday:1,lesson_start:1,lesson_end:1,start_time:"08:00:00",end_time:"08:40:00",subject_id:"math",teacher:null,room:"каб. 305",effective_from:null,effective_to:null};
test("version diff distinguishes additions, removals, subject/time/room changes and normalizes room display",()=>{
  assert.equal(scheduleDiff([row],[{...row,room:"305"}]).changed.length,0);
  const result=scheduleDiff([row,{...row,id:"b",lesson_start:2}],[{...row,room:"307",subject_id:"physics",start_time:"09:00:00"},{...row,id:"c",lesson_start:3}]);
  assert.equal(result.added.length,1);assert.equal(result.removed.length,1);
  assert.deepEqual(result.changed[0].fields,["subject","time","room"]);
});
