import "server-only";
import { SmsHttp, safeSmsUrl } from "./http";
import { SmsError } from "./errors";
import { serverState } from "./html";
import { parseJceAssessmentRows, parseJceDiaryUrl, parseJceReferences, parseJceSubjects } from "./parser";
import type { SmsAssessment, SmsDiarySelection, SmsDiarySnapshot } from "./types";

const PAGE = {page:"1",start:"0",limit:"100"};
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function form(values:Record<string,string>={}) { return new URLSearchParams({...values,...PAGE}); }
function requestedId(value:unknown) { if(value===undefined)return undefined;if(typeof value!=="string"||!idPattern.test(value))throw new SmsError("sms_changed");return value; }
async function json(http:SmsHttp,path:string,values:Record<string,string>,referer:string) { return (await http.request(path,form(values),"json",referer)).body; }

type DiaryContext={snapshot:SmsDiarySnapshot;referer?:string};
async function context(http:SmsHttp,initial:{body:string;url:URL}|undefined,selection:SmsDiarySelection={}):Promise<DiaryContext> {
  const page=initial??await http.request("/root");
  if(serverState(page.body)?.User?.IsAuthenticated!==true||/\/account\/login/i.test(page.url.pathname))throw new SmsError("session_expired");

  const shell=await http.request("/jcediary/index/0");
  if(!/\/JCEJournal\/JceDiary\//i.test(shell.body))throw new SmsError("sms_changed");
  const referer=shell.url.href;
  const years=parseJceReferences(await json(http,"/Ref/GetSchoolYears?fullData=true",{},referer));
  const selectedYearId=requestedId(selection.yearId);
  const actual=years.filter(item=>item.actual);
  const year=selectedYearId?years.find(item=>item.id===selectedYearId):actual.length===1?actual[0]:undefined;
  if(!year)throw new SmsError("sms_changed");
  const terms=parseJceReferences(await json(http,"/Ref/GetPeriods",{schoolYearId:year.id},referer));
  const selectedTermId=requestedId(selection.termId);
  const term=selectedTermId?terms.find(item=>item.id===selectedTermId):undefined;
  if(selectedTermId&&!term)throw new SmsError("sms_changed");
  const base:SmsDiarySnapshot={student:{schoolYear:year.label,...(term?{term:term.label}:{})},subjects:[],filters:{yearId:year.id,...(term?{termId:term.id}:{}),years:years.map(({id,label})=>({id,label})),terms:terms.map(({id,label})=>({id,label}))},fetchedAt:new Date().toISOString()};
  if(!term)return {snapshot:base};

  const parallels=parseJceReferences(await json(http,"/JceDiary/GetParallels",{periodId:term.id},referer));
  if(parallels.length!==1)throw new SmsError("sms_changed");
  const classes=parseJceReferences(await json(http,"/JceDiary/GetKlasses",{periodId:term.id,parallelId:parallels[0].id},referer));
  if(classes.length!==1)throw new SmsError("sms_changed");
  const students=parseJceReferences(await json(http,"/JceDiary/GetStudents",{periodId:term.id,klassId:classes[0].id},referer));
  if(students.length!==1)throw new SmsError("sms_changed");
  const openBody=new URLSearchParams({periodId:term.id,parallelId:parallels[0].id,klassId:classes[0].id,studentId:students[0].id});
  const open=await http.request("/JceDiary/GetJceDiary",openBody,"json",referer);
  const diaryUrl=safeSmsUrl(parseJceDiaryUrl(open.body),http.config.origin,open.url.href);
  if(diaryUrl.pathname.toLocaleLowerCase()!=="/jce/diary/index")throw new SmsError("sms_changed");
  const allowed=new Set(["shId","qId","pId","lId","studId","subjects","theme","lang","ch"]);
  if([...diaryUrl.searchParams.keys()].some(key=>!allowed.has(key))||!["shId","qId","pId","lId","studId"].every(key=>diaryUrl.searchParams.get(key))||diaryUrl.searchParams.getAll("subjects").length<1||diaryUrl.searchParams.getAll("subjects").length>100)throw new SmsError("sms_changed");
  const diary=await http.request(diaryUrl.href);
  if(serverState(diary.body)?.User?.IsAuthenticated!==true||!/\/Jce\/diary\//i.test(diary.body))throw new SmsError("sms_changed");
  const subjects=parseJceSubjects(await json(http,"/Jce/Diary/GetSubjects",{},diary.url.href));
  return {snapshot:{...base,student:{displayName:students[0].label,className:classes[0].label,schoolYear:year.label,term:term.label},subjects,fetchedAt:new Date().toISOString()},referer:diary.url.href};
}

export async function fetchDiary(http:SmsHttp,initial?:{body:string;url:URL},selection:SmsDiarySelection={}):Promise<SmsDiarySnapshot> {
  return (await context(http,initial,selection)).snapshot;
}

export async function fetchDiarySubject(http:SmsHttp,selection:SmsDiarySelection,subjectId:string):Promise<SmsAssessment[]> {
  requestedId(subjectId);
  const loaded=await context(http,undefined,selection),subject=loaded.snapshot.subjects.find(item=>item.sourceId===subjectId);
  if(!loaded.referer||!subject?.journalId||!subject.evaluations)throw new SmsError("sms_changed");
  const assessments:SmsAssessment[]=[];
  for(const evaluation of subject.evaluations){
    const body=await json(http,"/Jce/Diary/GetResultByEvalution",{journalId:subject.journalId,evalId:evaluation.id},loaded.referer);
    assessments.push(...parseJceAssessmentRows(body,subject.subject,evaluation.type));
  }
  return assessments;
}
