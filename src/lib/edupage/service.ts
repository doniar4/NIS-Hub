import "server-only";
import {createHash} from "node:crypto";
import type {ClassRow,SubjectRow,WeeklyLesson} from "../database.types";
import {canonicalLesson,eduPageDiff} from "./diff";
import {mapEduPage,type EduPageAliases} from "./mapping";
import type {EduPageSnapshot} from "./types";
export function prepareEduPage(snapshot:EduPageSnapshot,sourceHash:string,activeVersion:string,
  lessons:WeeklyLesson[],classes:ClassRow[],subjects:SubjectRow[],aliases:EduPageAliases,scope:string[]) {
  const mapped=mapEduPage(snapshot,classes,subjects,aliases,scope);
  const before=lessons.filter(row=>mapped.scope.includes(row.class_id));
  const diff=eduPageDiff(before,mapped.rows);
  const stable=(rows:typeof mapped.rows)=>rows.map(canonicalLesson).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const fingerprint=createHash("sha256").update(JSON.stringify({sourceHash,activeVersion,scope:mapped.scope,
    before:stable(before),after:stable(mapped.rows),issues:mapped.issues})).digest("hex");
  return {...mapped,diff,fingerprint,activeVersion,sourceHash,publication:snapshot.publication,
    classes:snapshot.classes,subjects:mapped.sourceSubjects,counts:snapshot.counts};
}
export type EduPagePreview=ReturnType<typeof prepareEduPage>;
