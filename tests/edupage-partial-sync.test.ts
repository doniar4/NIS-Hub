import test from "node:test";
import assert from "node:assert/strict";
import type {ClassRow,SubjectRow} from "../src/lib/database.types";
import type {EduPageSnapshot} from "../src/lib/edupage/types";
import {mapEduPage} from "../src/lib/edupage/mapping";

const classA="11111111-1111-4111-8111-111111111111";
const classB="22222222-2222-4222-8222-222222222222";
const math="33333333-3333-4333-8333-333333333333";

test("EduPage partial sync keeps safe classes when another class has an unknown subject",()=>{
  const classes:ClassRow[]=[{id:classA,name:"8A",grade:8,section:"A",created_at:""},{id:classB,name:"8B",grade:8,section:"B",created_at:""}];
  const subjects:SubjectRow[]=[{id:math,name:"Math",name_ru:"Математика",name_kz:"Математика",name_en:"Math",short_name:"Math",created_at:""}];
  const snapshot:EduPageSnapshot={
    publication:{number:"1",year:2026,label:"2026",effectiveFrom:"2026-09-01",effectiveTo:null},
    classes:[{id:"ca",name:"8A",short:"8A"},{id:"cb",name:"8B",short:"8B"}],
    subjects:[{id:"sm",name:"Math",short:"Math"},{id:"sx",name:"Unknown",short:"Unknown"}],
    lessons:[
      {sourceClass:"ca",sourceSubject:"sm",weekday:1,lesson_start:1,lesson_end:1,start_time:"08:30",end_time:"09:10",rooms:[],teachers:[],groups:[],entireClass:true,subgroup_key:"",subgroup_label:null,audience:"{(,)}"},
      {sourceClass:"cb",sourceSubject:"sx",weekday:1,lesson_start:1,lesson_end:1,start_time:"08:30",end_time:"09:10",rooms:[],teachers:[],groups:[],entireClass:true,subgroup_key:"",subgroup_label:null,audience:"{(,)}"}
    ],
    counts:{classes:2,subjectDefinitions:2,lessonDefinitions:2,cards:2,classLessons:2,nonClassCards:0}
  };
  const result=mapEduPage(snapshot,classes,subjects,{classes:{},subjects:{}});
  assert.deepEqual(result.scope,[classA]);
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].class_id,classA);
  assert.equal(result.blockedClasses.length,1);
  assert.equal(result.blockedClasses[0].name,"8B");
});
