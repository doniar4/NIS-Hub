import "server-only";
import { SmsHttp, safeSmsUrl } from "./http";
import { SmsError } from "./errors";
import { serverState } from "./html";
import { parseJceAssessmentRows, parseJceDiaryUrl, parseJceReferences, parseJceSubjects } from "./parser";
import type { SmsAssessment, SmsDiarySelection, SmsDiarySnapshot } from "./types";
import {currentSmsTerm} from "./recent";

const PAGE = {page:"1",start:"0",limit:"100"};
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function form(values:Record<string,string>={}) { return new URLSearchParams({...values,...PAGE}); }
function requestedId(value:unknown) { if(value===undefined)return undefined;if(typeof value!=="string"||!idPattern.test(value))throw new SmsError("sms_changed");return value; }
async function json(http:SmsHttp,path:string,values:Record<string,string>,referer:string) { return (await http.request(path,form(values),"json",referer)).body; }

type DiaryContext={snapshot:SmsDiarySnapshot;referer?:string};
async function context(http:SmsHttp,initial:{body:string;url:URL}|undefined,selection:SmsDiarySelection={},selectCurrentTerm=false):Promise<DiaryContext> {
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
  const term=selectedTermId?terms.find(item=>item.id===selectedTermId):selectCurrentTerm?currentSmsTerm(terms):undefined;
  if(selectedTermId&&!term)throw new SmsError("sms_changed");
  const base:SmsDiarySnapshot={student:{schoolYear:year.label,...(term?{term:term.label}:{})},subjects:[],filters:{yearId:year.id,...(term?{termId:term.id}:{}),years:years.map(({id,label})=>({id,label})),terms:terms.map(({id,label})=>({id,label}))},fetchedAt:new Date().toISOString()};
  if(!term)return {snapshot:base};

  const parallels=parseJceReferences(await json(http,"/JceDiary/GetParallels",{periodId:term.id},referer));
  const parallel=parallels.length===1?parallels[0]:parallels.find(p=>p.actual);
  if(!parallel)throw new SmsError("sms_changed");
  const classes=parseJceReferences(await json(http,"/JceDiary/GetKlasses",{periodId:term.id,parallelId:parallel.id},referer));
  const klass=classes.length===1?classes[0]:classes.find(c=>c.actual);
  if(!klass)throw new SmsError("sms_changed");
  const students=parseJceReferences(await json(http,"/JceDiary/GetStudents",{periodId:term.id,klassId:klass.id},referer));
  const student=students.length===1?students[0]:students.find(s=>s.actual);
  if(!student)throw new SmsError("sms_changed");
  const openBody=new URLSearchParams({periodId:term.id,parallelId:parallel.id,klassId:klass.id,studentId:student.id});
  const open=await http.request("/JceDiary/GetJceDiary",openBody,"json",referer);
  const diaryUrl=safeSmsUrl(parseJceDiaryUrl(open.body),http.config.origin,open.url.href);
  if(!diaryUrl.pathname.toLowerCase().includes("/diary/index"))throw new SmsError("sms_changed");
  const allowed=new Set(["shId","qId","pId","lId","studId","subjects","theme","lang","ch","v"]);
  if([...diaryUrl.searchParams.keys()].some(key=>!allowed.has(key))||!["shId","qId","pId","lId","studId"].every(key=>diaryUrl.searchParams.has(key))||diaryUrl.searchParams.getAll("subjects").length<1||diaryUrl.searchParams.getAll("subjects").length>100)throw new SmsError("sms_changed");
  const diary=await http.request(diaryUrl.href);
  if(serverState(diary.body)?.User?.IsAuthenticated!==true||!/\/Jce\/diary\//i.test(diary.body))throw new SmsError("sms_changed");
  const subjects=parseJceSubjects(await json(http,"/Jce/Diary/GetSubjects",{},diary.url.href));
  return {snapshot:{...base,student:{displayName:student.label,className:klass.label,schoolYear:year.label,term:term.label},subjects,fetchedAt:new Date().toISOString()},referer:diary.url.href};
}

export async function fetchDiary(http:SmsHttp,initial?:{body:string;url:URL},selection:SmsDiarySelection={}):Promise<SmsDiarySnapshot> {
  return (await context(http,initial,selection)).snapshot;
}

const PRELOAD_EVALUATIONS = 32;
const PRELOAD_CONCURRENCY = 4;
export async function fetchDiaryWithWorks(http:SmsHttp,initial?:{body:string;url:URL},selection:SmsDiarySelection={}):Promise<SmsDiarySnapshot> {
  const loaded=await context(http,initial,selection);
  if(!loaded.referer)return loaded.snapshot;
  for(const subject of loaded.snapshot.subjects)if(subject.evaluations?.length===0)subject.assessmentsLoaded=true;
  const eligible=loaded.snapshot.subjects.filter(subject=>subject.journalId&&subject.evaluations?.length);
  let budget=PRELOAD_EVALUATIONS;
  const selected=eligible.filter(subject=>{
    const count=subject.evaluations!.length;
    if(count>budget)return false;
    budget-=count;return true;
  });
  const jobs=selected.flatMap(subject=>subject.evaluations!.map((evaluation,index)=>({subject,evaluation,index})));
  const results=new Map<string,{rows:SmsAssessment[][];failed:boolean}>();
  for(const subject of selected)results.set(subject.sourceId!,{rows:Array(subject.evaluations!.length),failed:false});
  for(let start=0;start<jobs.length;start+=PRELOAD_CONCURRENCY){
    await Promise.all(jobs.slice(start,start+PRELOAD_CONCURRENCY).map(async job=>{
      const result=results.get(job.subject.sourceId!)!;
      try {
        const body=await json(http,"/Jce/Diary/GetResultByEvalution",{journalId:job.subject.journalId!,evalId:job.evaluation.id},loaded.referer!);
        result.rows[job.index]=parseJceAssessmentRows(body,job.subject.subject,job.evaluation.type);
      } catch { result.failed=true; }
    }));
  }
  for(const subject of selected){
    const result=results.get(subject.sourceId!)!;
    if(!result.failed&&result.rows.every(Boolean)){
      subject.assessments=result.rows.flat();
      subject.assessmentsLoaded=true;
    }
  }
  return loaded.snapshot;
}

export async function fetchDiarySubject(http:SmsHttp,selection:SmsDiarySelection,subjectId:string):Promise<SmsAssessment[]> {
  requestedId(subjectId);
  const loaded=await context(http,undefined,selection),subject=loaded.snapshot.subjects.find(item=>item.sourceId===subjectId);
  if(!loaded.referer||!subject?.journalId||!subject.evaluations)throw new SmsError("sms_changed");
  const assessments:SmsAssessment[]=[];
  const jId = subject.journalId;
  const ref = loaded.referer;
  const bodies = await Promise.all(subject.evaluations.map(e => json(http,"/Jce/Diary/GetResultByEvalution",{journalId:jId,evalId:e.id},ref)));
  for(let i=0; i<subject.evaluations.length; i++){
    assessments.push(...parseJceAssessmentRows(bodies[i],subject.subject,subject.evaluations[i].type));
  }
  return assessments;
}

export async function fetchRecentWorks(http:SmsHttp,selection:SmsDiarySelection={}):Promise<SmsAssessment[]> {
  const loaded=await context(http,undefined,selection,true);
  if(!loaded.referer) throw new SmsError("sms_changed");
  const ref = loaded.referer;
  const assessments:SmsAssessment[]=[];
  const subjectsWithEvals = loaded.snapshot.subjects.filter(s => s.journalId && s.evaluations && s.evaluations.length > 0);
  const jobs=subjectsWithEvals.flatMap(subject=>(subject.evaluations??[]).map(e=>({subject,e}))).slice(0,48);
  for(let start=0;start<jobs.length;start+=4) {
    const parsedLists=await Promise.all(jobs.slice(start,start+4).map(async({subject,e})=>{
      const body=await json(http,"/Jce/Diary/GetResultByEvalution",{journalId:subject.journalId!,evalId:e.id},ref);
      return parseJceAssessmentRows(body,subject.subject,e.type);
    }));
    for(const list of parsedLists)assessments.push(...list);
  }
  assessments.sort((a, b) => (b.date || "0000").localeCompare(a.date || "0000"));
  return assessments;
}
