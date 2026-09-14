import test from "node:test";
import assert from "node:assert/strict";
import {dayReasons,schoolDayJump,isSchoolDay} from "../src/lib/school-calendar";
test("school-day arrows skip weekends both ways and explain the entire interval",()=>{
  assert.deepEqual(schoolDayJump("2026-09-18",1,[],"en"),{date:"2026-09-21",skipped:[{start:"2026-09-19",end:"2026-09-20",reasons:["Weekend"]}]});
  assert.equal(schoolDayJump("2026-09-21",-1,[],"ru").date,"2026-09-18");
});
test("vacations, overlapping cancellations and today-off use inclusive dates and retain every reason",()=>{
  const days=[{start_date:"2026-09-21",end_date:"2026-09-25",type:"vacation" as const,label:"Autumn"},{start_date:"2026-09-25",end_date:"2026-09-25",type:"cancelled" as const,label:"Closure"}];
  const result=schoolDayJump("2026-09-18",1,days,"en");
  assert.equal(result.date,"2026-09-28"); assert.equal(result.skipped.length,4);
  assert.equal(result.skipped[2].reasons.length,2);
  assert.equal(isSchoolDay("2026-09-25",days),false);
  assert.equal(dayReasons("2026-09-26",days,"kk")[0],"Демалыс күндері");
});
test("unbounded closure cannot hang navigation; year/month boundaries are real calendar dates",()=>{
  const days=[{start_date:"2026-01-01",end_date:"2028-01-01",type:"other" as const,label:"Closed"}];
  assert.equal(schoolDayJump("2026-01-01",1,days,"en").date,null);
  assert.equal(schoolDayJump("2026-12-31",1,[],"en").date,"2027-01-01");
});
