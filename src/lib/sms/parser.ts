import { attr, document, nodes, nodeText } from "./html";
import { SmsError } from "./errors";
import type { SmsAssessment, SmsDiarySnapshot, SmsEvaluationSource, SmsFilterOption, SmsSubjectSummary } from "./types";
const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase("ru").replace(/\s+/g," ").trim();
const labels: Record<string,string> = {
  "предмет":"subject","пән":"subject","subject":"subject",
  "балл":"score","баллы":"score","score":"score","ұпай":"score",
  "максимум":"max","макс. балл":"max","maximum":"max","max":"max",
  "дата":"date","күні":"date","date":"date",
  "вид работы":"type","assessment":"type","жұмыс түрі":"type",
  "процент":"percent","пайыз":"percent","percent":"percent","%":"percent",
  "тема":"title","тақырып":"title","title":"title",
};
function decimal(raw: string, maximum = 10000): number | undefined {
  if (!raw || raw === "—" || raw === "-") return undefined;
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) throw new SmsError("parse_failed");
  const number = Number(raw.replace(",","."));
  if (!Number.isFinite(number) || number > maximum) throw new SmsError("parse_failed");
  return number;
}
function date(raw: string): string | undefined {
  if (!raw || raw === "—") return undefined;
  const local = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  const result = local ? `${local[3]}-${local[2]}-${local[1]}` : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0,10) !== result) throw new SmsError("parse_failed");
  return result;
}
// Legacy semantic-table adapter kept for compatibility with earlier fixtures.
// The verified JCE Diary JSON contract is parsed by the strict adapters below.
export function parseGrades(html: string, now = new Date()): SmsDiarySnapshot {
  const root = document(html), subjects = new Map<string,SmsSubjectSummary>();
  let recognized = false, count = 0;
  for (const table of nodes(root,"table")) {
    const rows = nodes(table,"tr").map(row => row.childNodes.filter(n => "tagName" in n && ["td","th"].includes(n.tagName)).map(nodeText));
    const headerIndex = rows.findIndex(row => row.some(c => labels[normalize(c)] === "subject") && row.some(c => ["score","percent"].includes(labels[normalize(c)])));
    if (headerIndex < 0) continue;
    recognized = true;
    const header = rows[headerIndex].map(c => labels[normalize(c)]);
    const known = header.filter(Boolean);
    if (new Set(known).size !== known.length) throw new SmsError("sms_changed");
    for (const row of rows.slice(headerIndex+1).filter(r=>r.some(Boolean))) {
      if (++count > 2000 || row.length !== header.length) throw new SmsError("sms_changed");
      const at = (name:string) => row[header.indexOf(name)]?.trim() || "";
      const subject = at("subject");
      if (!subject || subject.length > 160 || /\d{12}/.test(subject)) throw new SmsError("parse_failed");
      const pair = at("score").split("/");
      if (pair.length > 2) throw new SmsError("parse_failed");
      const score = decimal(pair[0].trim()), max = decimal(at("max") || pair[1]?.trim() || "");
      if (pair[1] && at("max") && decimal(pair[1].trim()) !== max) throw new SmsError("parse_failed");
      if (max === 0 || (score !== undefined && max !== undefined && score > max)) throw new SmsError("parse_failed");
      const supplied = decimal(at("percent").replace(/%$/,"").trim(),100);
      const percent = supplied ?? (score !== undefined && max !== undefined ? Math.round(score/max*1000)/10 : undefined);
      const rawType = normalize(at("type"));
      const type = ["сор","бжб","sor"].includes(rawType) ? "sor" : ["соч","тжб","soch"].includes(rawType) ? "soch" : ["фо","қб","formative"].includes(rawType) ? "formative" : rawType ? "other" : undefined;
      const assessment: SmsAssessment = {subject,score,max,percent,date:date(at("date")),type,
        title:at("title").slice(0,200) || undefined,percentSource:percent===undefined?undefined:supplied===undefined?"derived":"official_display"};
      if (!subjects.has(subject)) subjects.set(subject,{subject,assessments:[]});
      const summary = subjects.get(subject)!;
      // A subject-only percentage row is official summary; work rows remain separate.
      if (supplied !== undefined && score === undefined && !at("date") && !at("type") && !at("title")) {
        if (summary.percent !== undefined) throw new SmsError("sms_changed");
        summary.percent = supplied; summary.percentSource = "official_display";
      } else summary.assessments.push(assessment);
    }
  }
  if (!recognized || subjects.size > 100) throw new SmsError("sms_changed");
  for (const subject of subjects.values()) subject.assessments.sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999"));
  return {student:{},subjects:[...subjects.values()],fetchedAt:now.toISOString()};
}
export type DiaryFilter = {name:string; label:"year"|"term"; options:{value:string;label:string}[]};
export function gradeFilters(html: string) {
  const root=document(html), selects=nodes(root,"select"), allLabels=nodes(root,"label");
  const result: DiaryFilter[]=[];
  for (const select of selects) {
    const label=normalize(attr(select,"aria-label") || allLabels.filter(l=>attr(l,"for")===attr(select,"id") && attr(select,"id")).map(nodeText).join(" "));
    const kind=["учебный год","оқу жылы","academic year"].includes(label)?"year":["четверть","тоқсан","term"].includes(label)?"term":null;
    if (!kind) continue;
    const name=attr(select,"name");
    if (!name || result.some(f=>f.label===kind)) throw new SmsError("sms_changed");
    const options=nodes(select,"option").filter(o=>attr(o,"disabled")===undefined).map(o=>({value:attr(o,"value")??nodeText(o),label:nodeText(o)}));
    if (options.length>30 || options.some(o=>o.value.length>100 || o.label.length>100)) throw new SmsError("sms_changed");
    result.push({name,label:kind,options});
  }
  return result;
}

type JsonObject = Record<string,unknown>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(value:unknown):JsonObject { if(!value||typeof value!=="object"||Array.isArray(value))throw new SmsError("sms_changed");return value as JsonObject; }
function text(value:unknown,max=200) { if(typeof value!=="string"||!value.trim()||value.length>max||/\d{12}/.test(value))throw new SmsError("parse_failed");return value.trim(); }
function sourceId(value:unknown) { if(typeof value!=="string"||!uuid.test(value))throw new SmsError("sms_changed");return value; }
function numeric(value:unknown,min:number,max:number) { if(typeof value!=="number"||!Number.isFinite(value)||value<min||value>max)throw new SmsError("parse_failed");return value; }
function envelope(raw:string,max=100):{data:unknown[];total?:number} {
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new SmsError("sms_changed");}
  const root=object(value);if(root.success!==true||!Array.isArray(root.data)||root.data.length>max)throw new SmsError("sms_changed");
  if(root.total!==undefined&&root.total!==null)numeric(root.total,0,500);
  return {data:root.data,total:typeof root.total==="number"?root.total:undefined};
}
export type JceReference = SmsFilterOption & {actual?:boolean};
export function parseJceReferences(raw:string,max=100):JceReference[] {
  return envelope(raw,max).data.map(item=>{const row=object(item),data=row.Data===null||row.Data===undefined?undefined:object(row.Data);return {id:sourceId(row.Id),label:text(row.Name,160),...(data?.IsActual===true?{actual:true}:{})};});
}
export function parseJceDiaryUrl(raw:string) {
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new SmsError("sms_changed");}
  const root=object(value),data=object(root.data);if(root.success!==true||typeof data.Url!=="string"||data.Url.length>12000)throw new SmsError("sms_changed");return data.Url;
}
function assessmentType(...values:string[]):SmsAssessment["type"] {
  const value=normalize(values.join(" "));
  if(/(^|\s)(сор|бжб|sor)(\s|$)|суммативн\S* оцениван\S* (за )?раздел|бөлім\S* жиынтық/.test(value))return "sor";
  if(/(^|\s)(соч|тжб|soch)(\s|$)|суммативн\S* оцениван\S* (за )?(четверт|тоқсан)|тоқсан\S* жиынтық/.test(value))return "soch";
  if(/(^|\s)(фо|қб|formative)(\s|$)|форматив|қалыптастыру/.test(value))return "formative";
  return "other";
}
export function parseJceSubjects(raw:string):SmsSubjectSummary[] {
  return envelope(raw,100).data.map(item=>{
    const row=object(item),subject=text(row.Name,160),evaluations=row.Evaluations;
    if(!Array.isArray(evaluations)||evaluations.length>12)throw new SmsError("sms_changed");
    const sources:SmsEvaluationSource[]=evaluations.map(value=>{
      const evaluation=object(value),label=text(evaluation.Name,200),shortLabel=typeof evaluation.ShortName==="string"?evaluation.ShortName.trim():"";
      if(shortLabel.length>80)throw new SmsError("parse_failed");
      numeric(evaluation.Type,-100,100);numeric(evaluation.EvalType,-100,100);numeric(evaluation.Formula,-100,100);numeric(evaluation.Percent,0,100);
      if(typeof evaluation.IsCanDontConsider!=="boolean")throw new SmsError("sms_changed");
      const maxima=object(evaluation.MaxScores);if(Object.keys(maxima).length>200)throw new SmsError("sms_changed");
      for(const [id,maximum] of Object.entries(maxima)){sourceId(id);numeric(maximum,-1,10000);}
      return {id:sourceId(evaluation.Id),label,...(shortLabel?{shortLabel}:{}),type:assessmentType(shortLabel,label)};
    });
    const score=numeric(row.Score,0,100),mark=numeric(row.Mark,0,10);
    if(!Number.isInteger(mark)||(row.MarkComment!==null&&row.MarkComment!==undefined&&(typeof row.MarkComment!=="string"||row.MarkComment.length>1000)))throw new SmsError("parse_failed");
    return {subject,sourceId:sourceId(row.Id),journalId:sourceId(row.JournalId),percent:score,percentSource:"official_display" as const,...(mark===1?{notAttested:true}:mark>1?{currentMark:mark}:{}),evaluations:sources,assessments:[]};
  });
}
export function parseJceAssessmentRows(raw:string,subject:string,type:SmsAssessment["type"]):SmsAssessment[] {
  const parsed=envelope(raw,100);if(parsed.total!==undefined&&parsed.total>parsed.data.length)throw new SmsError("sms_changed");
  return parsed.data.flatMap(item=>{
    const row=object(item),disabled=row.Disabled;
    if(typeof disabled!=="boolean")throw new SmsError("sms_changed");
    const title=text(row.Name,200),score=numeric(row.Score,-1,10000),max=numeric(row.MaxScore,-1,10000);
    if(row.Description!==undefined&&row.Description!==null&&(typeof row.Description!=="string"||row.Description.length>2000))throw new SmsError("parse_failed");
    if(row.Comment!==undefined&&row.Comment!==null&&(typeof row.Comment!=="string"||row.Comment.length>2000))throw new SmsError("parse_failed");
    if(row.Id!==undefined)sourceId(row.Id);if(row.RubricId!==undefined&&row.RubricId!==null)sourceId(row.RubricId);
    if(disabled||score<0)return [];
    const usableMax=max>=0?max:undefined;if(usableMax===0||usableMax!==undefined&&score>usableMax)throw new SmsError("parse_failed");
    const percent=usableMax===undefined?undefined:Math.round(score/usableMax*1000)/10;
    return [{subject,title,type,score,max:usableMax,percent,percentSource:percent===undefined?undefined:"derived" as const}];
  });
}
