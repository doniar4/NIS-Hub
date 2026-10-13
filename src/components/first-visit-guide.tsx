import Link from "next/link";
import {Check,ArrowRight} from "lucide-react";
import type {Locale} from "@/lib/i18n";
import {firstVisitCopy} from "@/lib/first-visit-copy";
import {profileCompletion,type CompletionProfile} from "@/lib/profile-completion";

export function FirstVisitGuide({profile,top,locale,classAvailable}:{profile:CompletionProfile;top:string[];locale:Locale;classAvailable:boolean}) {
 const p=firstVisitCopy(locale),steps=profileCompletion(profile,top);
 const items=[{done:steps.school,label:p.school,href:"#school-settings"},{done:steps.name,label:p.name,href:"#profile-name"},
  {done:steps.cls,label:p.cls,href:"#profile-class"},{done:steps.avatar,label:p.avatar,href:"#profile-avatar"},{done:steps.top,label:p.top,href:"#profile-subjects"}];
 const ready=items.filter(item=>item.done).length,next=items.find(item=>!item.done&&(item.href!=="#profile-class"||classAvailable));
 return <section className="surface-card first-visit-guide" aria-labelledby="first-visit-title">
  <div className="first-visit-guide-heading"><div><p>{p.welcome}</p><h2 id="first-visit-title">{p.title}</h2><span>{p.intro}</span></div><span className="first-visit-count">{p.progress} {ready}/5</span></div>
  <ol>{items.map((item,index)=><li key={item.label} data-done={item.done}><Link href={item.href}><span aria-hidden="true">{item.done?<Check size={14}/>:index+1}</span>{item.label}</Link></li>)}</ol>
  {!classAvailable&&!steps.cls&&<p className="first-visit-class-note">{p.classLater}</p>}
  <footer><p>{p.activityHint}</p><Link className="button button-secondary" href={next?.href??"/library"}>{next?p.action:p.explore}<ArrowRight size={16}/></Link></footer>
 </section>;
}
