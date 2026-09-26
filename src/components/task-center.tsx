"use client";

import Link from "next/link";
import {useEffect,useMemo,useState,useTransition} from "react";
import {Archive,Bell,BellOff,CalendarDays,Check,CheckCircle2,ChevronRight,Clock3,Flag,ListTodo,Pencil,Plus} from "lucide-react";
import {savePersonalTask,setPersonalTaskStatus,type SaveTaskInput} from "@/app/actions/tasks";
import type {PersonalTask,SubjectRow,TaskPriority} from "@/lib/database.types";
import {tasksCopy} from "@/lib/tasks-copy";
import {subjectName} from "@/lib/i18n";
import {useI18n} from "./locale-provider";
import {TaskDialog} from "./task-dialog";

type Filter="today"|"upcoming"|"completed"|"all";
type ReminderMode="none"|"due"|"10"|"30"|"60"|"180"|"1440"|"custom";
const ranks:Record<TaskPriority,number>={urgent:0,high:1,medium:2,low:3};
const browserPreference="nis-task-browser-notifications";

function localInput(value:string|null){
 if(!value)return "";const date=new Date(value),offset=date.getTimezoneOffset()*60000;
 return new Date(date.getTime()-offset).toISOString().slice(0,16);
}
function iso(value:string){return value?new Date(value).toISOString():null;}
function dayKey(value:Date){return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;}
function taskDay(value:string|null){return value?dayKey(new Date(value)):null;}
function reminderMode(task:PersonalTask|null):ReminderMode{
 if(!task?.remind_at||!task.due_at)return "none";
 const minutes=Math.round((Date.parse(task.due_at)-Date.parse(task.remind_at))/60000);
 return ([0,10,30,60,180,1440] as const).includes(minutes as 0|10|30|60|180|1440)?(minutes===0?"due":String(minutes) as ReminderMode):"custom";
}
function sortedTasks(rows:PersonalTask[]){
 return [...rows].sort((a,b)=>{
  if(a.status!==b.status)return a.status==="active"?-1:1;
  if(a.status==="active"&&ranks[a.priority]!==ranks[b.priority])return ranks[a.priority]-ranks[b.priority];
  if(a.due_at&&b.due_at)return Date.parse(a.due_at)-Date.parse(b.due_at);
  if(a.due_at)return -1;if(b.due_at)return 1;
  return Date.parse(b.created_at)-Date.parse(a.created_at);
 });
}

function NotificationPreference(){
 const {locale}=useI18n(),p=tasksCopy(locale);
 const [state,setState]=useState<"unsupported"|"default"|"denied"|"enabled"|"disabled">("default");
 useEffect(()=>{
  const timer=window.setTimeout(()=>{
   if(!("Notification" in window)){setState("unsupported");return;}
   if(Notification.permission==="denied"){setState("denied");return;}
   setState(Notification.permission==="granted"&&localStorage.getItem(browserPreference)!=="disabled"?"enabled":"disabled");
  },0);
  return()=>window.clearTimeout(timer);
 },[]);
 const toggle=async()=>{
  if(!("Notification" in window))return;
  if(state==="enabled"){localStorage.setItem(browserPreference,"disabled");setState("disabled");return;}
  const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
  if(permission==="granted"){localStorage.setItem(browserPreference,"enabled");setState("enabled");}
  else setState(permission==="denied"?"denied":"disabled");
 };
 return <div className="task-notification-setting">
  <span className="task-setting-icon" aria-hidden="true">{state==="enabled"?<Bell size={18}/>:<BellOff size={18}/>}</span>
  <span><strong>{p.browserTitle}</strong><small>{state==="denied"?p.browserDenied:state==="unsupported"?p.browserUnsupported:p.browserHint}</small></span>
  {state!=="denied"&&state!=="unsupported"&&<button type="button" className="task-setting-button" onClick={()=>void toggle()} aria-pressed={state==="enabled"}>{state==="enabled"?p.disableBrowser:p.enableBrowser}</button>}
 </div>;
}

function TaskForm({task,subjects,onClose,onSaved,onArchived}:{task:PersonalTask|null;subjects:SubjectRow[];onClose:()=>void;onSaved:(task:PersonalTask)=>void;onArchived:(task:PersonalTask)=>void}){
 const {locale}=useI18n(),p=tasksCopy(locale),[pending,start]=useTransition(),[error,setError]=useState("");
 const [due,setDue]=useState(localInput(task?.due_at??null)),[mode,setMode]=useState<ReminderMode>(reminderMode(task)),[custom,setCustom]=useState(localInput(task?.remind_at??null));
 const priority=task?.priority??"medium";
 const submit=(form:FormData)=>{
  const dueIso=iso(due);let remind:string|null=null;
  if(dueIso&&mode!=="none"){
   if(mode==="custom")remind=iso(custom);
   else{const minutes=mode==="due"?0:Number(mode);remind=new Date(Date.parse(dueIso)-minutes*60000).toISOString();}
  }
  const input:SaveTaskInput={id:task?.id??null,title:String(form.get("title")??""),notes:String(form.get("notes")??""),priority:String(form.get("priority")??priority) as TaskPriority,subject:String(form.get("subject")??"")||null,due:dueIso,remind};
  start(async()=>{const result=await savePersonalTask(input);if("error" in result){setError(p[result.error]??p.failed);return;}onSaved(result.data);});
 };
 const archive=()=>task&&start(async()=>{const result=await setPersonalTaskStatus(task.id,"archived");if("error" in result){setError(p[result.error]??p.failed);return;}onArchived(result.data);});
 return <TaskDialog title={task?p.edit:p.add} subtitle={p.subtitle} onClose={onClose} busy={pending}>
  <form className="personal-task-form" action={submit}>
   <label><span className="field-label">{p.taskTitle}</span><input data-dialog-autofocus className="field" name="title" required maxLength={120} defaultValue={task?.title??""} placeholder={p.taskTitlePlaceholder}/></label>
   <label><span className="field-label">{p.notes} <small>· {p.optional}</small></span><textarea className="field" name="notes" rows={3} maxLength={1000} defaultValue={task?.notes??""} placeholder={p.notesPlaceholder}/></label>
   <fieldset className="task-priority-picker"><legend>{p.priority}</legend>
    {(["low","medium","high","urgent"] as TaskPriority[]).map(value=><label key={value} data-priority={value}><input type="radio" name="priority" value={value} defaultChecked={priority===value}/><Flag size={15} aria-hidden="true"/><span>{p[value]}</span></label>)}
   </fieldset>
   <div className="task-form-grid">
    <label><span className="field-label">{p.subject}</span><select className="field" name="subject" defaultValue={task?.subject_id??""}><option value="">{p.noSubject}</option>{subjects.map(subject=><option key={subject.id} value={subject.id}>{subjectName(subject,locale)}</option>)}</select></label>
    <label><span className="field-label">{p.due}</span><input className="field" type="datetime-local" value={due} onChange={event=>{setDue(event.target.value);if(!event.target.value)setMode("none");}}/></label>
    <label><span className="field-label">{p.reminder}</span><select className="field" value={mode} disabled={!due} onChange={event=>setMode(event.target.value as ReminderMode)}>
     <option value="none">{p.remindNone}</option><option value="due">{p.remindAtDue}</option><option value="10">{p.remind10}</option><option value="30">{p.remind30}</option><option value="60">{p.remind60}</option><option value="180">{p.remind180}</option><option value="1440">{p.remindDay}</option><option value="custom">{p.remindCustom}</option>
    </select></label>
    {mode==="custom"&&due&&<label><span className="field-label">{p.reminderTime}</span><input className="field" type="datetime-local" value={custom} max={due} required onChange={event=>setCustom(event.target.value)}/></label>}
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <footer className="task-form-actions">
    {task&&<button type="button" className="task-archive-button" disabled={pending} onClick={archive}><Archive size={17}/>{p.archive}</button>}
    <span/>
    <button type="button" className="button button-secondary" disabled={pending} onClick={onClose}>{p.cancel}</button>
    <button className="button" disabled={pending}>{pending?p.saving:p.save}</button>
   </footer>
  </form>
 </TaskDialog>;
}

function TaskRow({task,subjects,onEdit,onChange,now,compact=false}:{task:PersonalTask;subjects:SubjectRow[];onEdit:(task:PersonalTask)=>void;onChange:(task:PersonalTask)=>void;now:number;compact?:boolean}){
 const {locale}=useI18n(),p=tasksCopy(locale),[pending,start]=useTransition(),[error,setError]=useState("");
 const current=new Date(now),subject=subjects.find(row=>row.id===task.subject_id),done=task.status==="completed",today=dayKey(current),tomorrow=dayKey(new Date(current.getFullYear(),current.getMonth(),current.getDate()+1)),dueDay=taskDay(task.due_at),overdue=!done&&!!task.due_at&&Date.parse(task.due_at)<now;
 const dateLabel=!task.due_at?p.noDeadline:dueDay===today?p.dueToday:dueDay===tomorrow?p.tomorrow:new Intl.DateTimeFormat(locale,{day:"numeric",month:"short"}).format(new Date(task.due_at));
 const time=task.due_at?new Intl.DateTimeFormat(locale,{hour:"2-digit",minute:"2-digit"}).format(new Date(task.due_at)):"";
 const toggle=()=>start(async()=>{const result=await setPersonalTaskStatus(task.id,done?"active":"completed");if("error" in result){setError(p[result.error]??p.failed);return;}onChange(result.data);});
 return <li className="personal-task-row" data-priority={task.priority} data-status={task.status} aria-busy={pending}>
  <button type="button" className="task-complete-button" onClick={toggle} disabled={pending} aria-label={`${done?p.undo:p.done}: ${task.title}`} title={done?p.undo:p.done}>{done?<Check size={18}/>:<span/>}</button>
  <div className="task-row-content">
   <div className="task-row-title"><strong>{task.title}</strong><span className="task-priority-label"><Flag size={12}/>{p[task.priority]}</span></div>
   {!compact&&task.notes&&<p>{task.notes}</p>}
   <div className="task-row-meta">{subject&&<span>{subjectName(subject,locale)}</span>}<span className={overdue?"is-overdue":""}><CalendarDays size={13}/>{overdue?p.overdue:dateLabel}{time&&` · ${time}`}</span>{task.remind_at&&<span title={p.reminder}><Bell size={13}/>{new Intl.DateTimeFormat(locale,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(task.remind_at))}</span>}</div>
   {error&&<small className="form-error" role="alert">{error}</small>}
  </div>
  <button type="button" className="task-edit-button" onClick={()=>onEdit(task)} aria-label={`${p.editAction}: ${task.title}`} title={p.editAction}><Pencil size={16}/></button>
 </li>;
}

export function TaskCenter({initialTasks,subjects,variant="full"}:{initialTasks:PersonalTask[];subjects:SubjectRow[];variant?:"full"|"compact"}){
 const {locale}=useI18n(),p=tasksCopy(locale),[tasks,setTasks]=useState(()=>sortedTasks(initialTasks)),[editing,setEditing]=useState<PersonalTask|null|undefined>(undefined),[filter,setFilter]=useState<Filter>("today"),[message,setMessage]=useState("");
 const [now]=useState(()=>Date.now()),active=tasks.filter(task=>task.status==="active"),completed=tasks.filter(task=>task.status==="completed"),today=dayKey(new Date(now));
 const visible=useMemo(()=>{
  const rows=variant==="compact"?active:filter==="completed"?completed:filter==="all"?tasks:active.filter(task=>filter==="today"?(task.due_at?taskDay(task.due_at)!<=today:false):(task.due_at?taskDay(task.due_at)!>today:true));
  return sortedTasks(rows).slice(0,variant==="compact"?4:200);
 },[active,completed,filter,tasks,today,variant]);
 const replace=(task:PersonalTask)=>{setTasks(rows=>sortedTasks(rows.some(row=>row.id===task.id)?rows.map(row=>row.id===task.id?task:row):[task,...rows]));setEditing(undefined);setMessage(task.status==="completed"?p.completedMessage:task.status==="archived"?p.archived:p.saved);window.dispatchEvent(new Event("nis-task-change"));window.dispatchEvent(new Event("nis-notifications-change"));};
 const denominator=active.length+completed.length,percent=denominator?Math.round(completed.length/denominator*100):0;
 return <section id="tasks" className={`surface-card task-center task-center-${variant}`}>
  <header className="task-center-header">
   <div className="task-center-heading"><span className="task-center-mark" aria-hidden="true"><ListTodo size={21}/></span><div><h2 className="section-title">{p.title}</h2><p>{variant==="compact"?p.quickHint:p.subtitle}</p></div></div>
   <button type="button" className="button task-add-button" onClick={()=>setEditing(null)}><Plus size={17}/>{p.add}</button>
  </header>
  {variant==="full"&&<>
   <div className="task-progress" aria-label={`${percent}% ${p.progress}`}><span><strong>{percent}%</strong> {p.progress}</span><span>{active.length} {p.remaining}</span><div><i style={{width:`${percent}%`}}/></div></div>
   <NotificationPreference/>
   <div className="task-filter" role="group" aria-label={p.title}>{(["today","upcoming","completed","all"] as Filter[]).map(item=><button type="button" key={item} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{p[item]}<span>{item==="completed"?completed.length:item==="all"?tasks.length:item==="today"?active.filter(task=>task.due_at&&taskDay(task.due_at)!<=today).length:active.filter(task=>!task.due_at||taskDay(task.due_at)!>today).length}</span></button>)}</div>
  </>}
  {message&&<p className="task-inline-status" role="status"><CheckCircle2 size={15}/>{message}<button type="button" onClick={()=>setMessage("")} aria-label={p.close}>×</button></p>}
  {visible.length?<ul className="personal-task-list">{visible.map(task=><TaskRow key={task.id} task={task} subjects={subjects} now={now} compact={variant==="compact"} onEdit={setEditing} onChange={replace}/>)}</ul>:<div className="task-empty"><span aria-hidden="true"><Clock3 size={23}/></span><strong>{variant==="full"&&tasks.length?p.emptyFiltered:p.empty}</strong><p>{variant==="full"&&tasks.length?p.emptyFiltered:p.emptyHint}</p></div>}
  {variant==="compact"&&<Link className="task-manage-link" href="/profile#tasks"><span>{p.openProfile}</span><ChevronRight size={17}/></Link>}
  {editing!==undefined&&<TaskForm task={editing} subjects={subjects} onClose={()=>setEditing(undefined)} onSaved={replace} onArchived={replace}/>} 
 </section>;
}
