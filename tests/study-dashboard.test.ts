import test from "node:test";
import assert from "node:assert/strict";
import {defaultLesson,studyHref} from "../src/lib/study-dashboard";
import {designCopy} from "../src/lib/design-copy";
import type {WeeklyLesson} from "../src/lib/database.types";

const rows=[["a","08:30","09:15"],["b","09:30","10:15"]].map(([id,start_time,end_time])=>({id,start_time,end_time}) as WeeklyLesson);
test("Lesson default follows current/next school time, with a stable first-lesson fallback",()=>{
  assert.equal(defaultLesson(rows,"2026-09-21","2026-09-21","08:00")?.id,"a");
  assert.equal(defaultLesson(rows,"2026-09-21","2026-09-21","09:00")?.id,"a");
  assert.equal(defaultLesson(rows,"2026-09-21","2026-09-21","09:20")?.id,"b");
  assert.equal(defaultLesson(rows,"2026-09-21","2026-09-21","09:40")?.id,"b");
  assert.equal(defaultLesson(rows,"2026-09-21","2026-09-21","18:00")?.id,"a");
  assert.equal(defaultLesson(rows,"2026-09-22","2026-09-21","09:40")?.id,"a");
  assert.equal(defaultLesson([],"2026-09-21","2026-09-21","09:40"),undefined);
});
test("Grounded AI destination preserves canonical subject/grade or the selected private edition",()=>{
  assert.equal(studyHref("/books/book/read?variant=edition"),"/books/book/read?variant=edition#ai-study");
  assert.equal(studyHref("/books/book"),"/books/book/read#ai-study");
  assert.equal(studyHref("/library?subject=canonical-id&grade=9"),"/library?subject=canonical-id&grade=9&study=1");
});
test("Every new interface label is available in RU/KZ/EN",()=>{
  for(const locale of ["ru","kk","en"] as const)for(const value of Object.values(designCopy(locale)))assert.ok(value.trim());
});
