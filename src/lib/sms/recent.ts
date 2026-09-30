import type {SmsAssessment,SmsDiarySnapshot} from "./types";

export const RECENT_SMS_CACHE_KEY="sms_diary_recent_works";
export const SMS_NOTICE_CACHE_KEY="nis-sms-result-notifications";
export type SmsResultNotice={id:string;kind:"sms";href:string;title:string;body_preview:string;created_at:string;read_at:string|null};

const normalize=(value:string)=>value.normalize("NFKC").toLocaleLowerCase("ru").replace(/\s+/g," ").trim();
export function currentSmsTerm<T extends {id:string;label:string}>(terms:T[],now=new Date()):T|undefined {
  if(!terms.length)return undefined;
  const month=Number(new Intl.DateTimeFormat("en",{timeZone:"Asia/Oral",month:"numeric"}).format(now));
  const expected=month>=9&&month<=11?1:month===12||month<=2?2:month<=4?3:4;
  const numeral=["","i","ii","iii","iv"][expected];
  return terms.find(term=>{
    const label=term.label.normalize("NFKC").toLocaleLowerCase("ru");
    return new RegExp(`(^|\\s)${expected}([\\s.\u2013\u2014-]|$)`).test(label)||new RegExp(`(^|\\s)${numeral}([\\s.\u2013\u2014-]|$)`).test(label);
  })??terms[0];
}
export function smsAssessmentKey(item:SmsAssessment):string {
  return [normalize(item.subject),item.type??"",item.date??"",normalize(item.title??"")].join("|");
}
export function sortSmsAssessments(items:SmsAssessment[]):SmsAssessment[] {
  return [...items].filter(item=>item.score!==undefined).sort((a,b)=>(b.date??"").localeCompare(a.date??"")||smsAssessmentKey(a).localeCompare(smsAssessmentKey(b)));
}
export function snapshotAssessments(snapshot:SmsDiarySnapshot|undefined):SmsAssessment[] {
  return sortSmsAssessments(snapshot?.subjects.flatMap(subject=>subject.assessments)??[]);
}
export function smsAssessmentChanges(current:SmsAssessment[],previous:SmsAssessment[]):Map<string,"new"|"updated"> {
  const before=new Map(previous.map(item=>[smsAssessmentKey(item),item]));
  const changes=new Map<string,"new"|"updated">();
  for(const item of current) {
    const old=before.get(smsAssessmentKey(item));
    if(!old)changes.set(smsAssessmentKey(item),"new");
    else if(old.score!==item.score||old.max!==item.max||old.percent!==item.percent)changes.set(smsAssessmentKey(item),"updated");
  }
  return changes;
}

export function parseSmsResultNotices(raw:string|null):SmsResultNotice[] {
  if(!raw)return [];
  try {
    const value:unknown=JSON.parse(raw);
    if(!Array.isArray(value))return [];
    return value.filter((item):item is SmsResultNotice=>{
      if(!item||typeof item!=="object")return false;
      const row=item as Partial<SmsResultNotice>;
      return row.kind==="sms"&&typeof row.id==="string"&&typeof row.href==="string"&&typeof row.title==="string"&&typeof row.body_preview==="string"&&typeof row.created_at==="string"&&(row.read_at===null||typeof row.read_at==="string");
    }).slice(0,20);
  } catch{return [];}
}
