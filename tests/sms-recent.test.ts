import test from "node:test";
import assert from "node:assert/strict";
import {currentSmsTerm,parseSmsResultNotices,smsAssessmentChanges,smsAssessmentKey,snapshotAssessments,sortSmsAssessments} from "../src/lib/sms/recent";
import type {SmsAssessment,SmsDiarySnapshot} from "../src/lib/sms/types";

const older:SmsAssessment={subject:" Математика ",title:"Раздел 1",type:"sor",date:"2026-09-20",score:12,max:16,percent:75};
const newer:SmsAssessment={subject:"Физика",title:"Работа",type:"formative",date:"2026-09-28",score:9,max:10,percent:90};

test("recent SMS helpers retain every scored work and order newest first",()=>{
  const snapshot:SmsDiarySnapshot={student:{},subjects:[{subject:"Математика",assessments:[older,{subject:"Математика",title:"Без оценки"}]},{subject:"Физика",assessments:[newer]}],fetchedAt:"2026-09-30T00:00:00Z"};
  assert.deepEqual(snapshotAssessments(snapshot),[newer,older]);
  assert.deepEqual(sortSmsAssessments([older,newer]),[newer,older]);
});

test("recent SMS diff distinguishes a new work from an updated score",()=>{
  const updated={...older,subject:"математика",score:13,percent:81.3};
  const changes=smsAssessmentChanges([updated,newer],[older]);
  assert.equal(changes.get(smsAssessmentKey(updated)),"updated");
  assert.equal(changes.get(smsAssessmentKey(newer)),"new");
});

test("current SMS term follows the school quarter and safely falls back",()=>{
  const terms=[{id:"1",label:"I четверть"},{id:"2",label:"II четверть"},{id:"3",label:"III четверть"},{id:"4",label:"IV четверть"}];
  assert.equal(currentSmsTerm(terms,new Date("2026-09-30T00:00:00Z"))?.id,"1");
  assert.equal(currentSmsTerm(terms,new Date("2027-01-10T00:00:00Z"))?.id,"2");
  assert.equal(currentSmsTerm([{id:"x",label:"Период"}],new Date("2026-09-30T00:00:00Z"))?.id,"x");
});

test("SMS result notification cache accepts only complete local notices",()=>{
  const notice={id:"sms-1",kind:"sms",href:"/diary",title:"Новые результаты",body_preview:"Физика: 9/10",created_at:"2026-09-30T00:00:00Z",read_at:null};
  assert.deepEqual(parseSmsResultNotices(JSON.stringify([notice,{kind:"sms"}])),[notice]);
  assert.deepEqual(parseSmsResultNotices("broken"),[]);
});
