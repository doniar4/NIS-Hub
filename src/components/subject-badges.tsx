import type { SubjectRow } from "@/lib/database.types";
import type { Locale } from "@/lib/i18n";
import { subjectName } from "@/lib/i18n";
import { SubjectMotif } from "./subject-motif";
export function SubjectBadges({ids,subjects,locale}:{ids:string[];subjects:SubjectRow[];locale:Locale}){
 return <ul className="subject-badges" aria-label="Top 4">{ids.slice(0,4).map(id=>{const subject=subjects.find(s=>s.id===id);return subject?<li key={id} className="subject-badge"><SubjectMotif subject={subject}/><span>{subjectName(subject,locale)}</span></li>:null;})}</ul>;
}
