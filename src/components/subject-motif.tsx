import type {SubjectRow} from "@/lib/database.types";
/** Original decorative motifs chosen from canonical metadata, never localized link text. */
export function SubjectMotif({subject}:{subject:SubjectRow|undefined}){
 const name=[subject?.name,subject?.name_en,subject?.short_name].join(" ").toLowerCase();
 let content:React.ReactNode=<><path d="M20 15h32l8 6 8-6h32v66H68l-8 6-8-6H20ZM60 21v66"/><path d="M28 30h18m-18 12h18m28-12h18m-18 12h18"/></>;
 if(/матем|алгеб|геомет|math|algebra|geometry/.test(name))content=<><path d="M15 85h90M30 92V10M24 74Q60 78 90 17M45 70l22-34 22 34Z"/><text x="65" y="90">x²</text></>;
 else if(/англ|english/.test(name))content=<><path d="M15 38h36v48H15ZM51 38h36v48H51"/><text x="24" y="27">ABC</text><text x="91" y="73">“</text></>;
 else if(/физ|physics/.test(name))content=<><ellipse cx="58" cy="43" rx="43" ry="16" transform="rotate(-30 58 43)"/><ellipse cx="58" cy="43" rx="43" ry="16" transform="rotate(30 58 43)"/><circle cx="58" cy="43" r="4"/><text x="40" y="90">F=ma</text></>;
 else if(/хим|chem/.test(name))content=<><path d="m28 15 21 12v24L28 63 7 51V27Zm42 24 21 12v24L70 87 49 75V51ZM49 27l21-12"/><text x="78" y="29">H₂O</text></>;
 else if(/биол|biology/.test(name))content=<><path d="M55 92V20M55 70C22 76 8 56 15 35c26 2 40 15 40 35ZM55 45C51 19 68 8 93 12c-1 23-13 35-38 33Z"/></>;
 else if(/истори|history|тарих/.test(name))content=<><path d="M9 88h105M18 88V48l36-25 36 25v40M31 86V53l23-15 23 15v33M48 86V66h14v20M4 98q45-10 105-1"/></>;
 return <svg aria-hidden="true" focusable="false" className="subject-motif" viewBox="0 0 120 110" fill="none" stroke="currentColor" strokeWidth="1.1">{content}</svg>;
}
