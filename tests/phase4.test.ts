import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { phase3Database, asUser, fixtureId as id } from "./helpers/database";
import { BOOK_PDF_BYTES, pdfFileIssue, validatePdfFile, canonicalBookPath } from "../src/lib/book-upload";
import { parseTimetable, parseWeekday, delimitedRows, TIMETABLE_HEADERS } from "../src/lib/timetable-import";
import { weeklyDay, schoolWeek } from "../src/lib/weekly-schedule";
import { phase4Copy } from "../src/lib/phase4-copy";
import type { ClassRow, SubjectRow } from "../src/lib/database.types";
const classes: ClassRow[] = [{ id:id(10),name:"9H",grade:9,section:"H",created_at:"" }];
const subjects: SubjectRow[] = [{ id:id(20), name:"Математика",name_kz:"Математика",name_en:"Mathematics",short_name:"Math",created_at:"" }];
const csv=(rows:string)=>TIMETABLE_HEADERS.join(",")+"\n"+rows;
const row="9H,Mon,1,2,08:30,10:10,Mathematics,Teacher,305";
test("Phase 4 PDF file validation before network: size, MIME, extension, header, deterministic path",async()=>{
  assert.equal(pdfFileIssue({name:"a.pdf",type:"application/pdf",size:BOOK_PDF_BYTES}),null);
  assert.equal(pdfFileIssue({name:"a.pdf",type:"application/pdf",size:BOOK_PDF_BYTES+1}),"pdfLarge");
  for(const file of [{name:"a.exe",type:"application/pdf",size:10},{name:"a.pdf",type:"image/png",size:10},{name:"a.pdf",type:"",size:0}]) assert.equal(pdfFileIssue(file),"pdfInvalid");
  assert.equal(await validatePdfFile(new File(["%PDF-1.7\n"],"a.pdf")) ,null);
  assert.equal(await validatePdfFile(new File(["not a pdf"],"a.pdf")) ,"pdfInvalid");
  assert.equal(canonicalBookPath(id(30)),canonicalBookPath(id(30)));
});
test("CSV/TSV quoting, BOM, CRLF, localized names and weekday aliases",()=>{
  const result=parseTimetable("\uFEFF"+csv(row).replace(/\n/g,"\r\n"),classes,subjects);
  assert.deepEqual(result.issues,[]); assert.equal(result.lessons[0].lesson_end,2);
  for(const name of ["Math","Математика","Mathematics"]) assert.deepEqual(parseTimetable(csv(row.replace("Mathematics",name)),classes,subjects).issues,[]);
  for(const name of ["Mon","monday","пн.","Понедельник","Дс","Дүйсенбі","1"]) assert.equal(parseWeekday(name),1);
  assert.equal(parseWeekday("Saturday"),0);
  assert.deepEqual(parseTimetable(csv(row).replace(/,/g,"\t"),classes,subjects).issues,[]);
  assert.deepEqual(delimitedRows('a,b\n"x,y","one ""quote""\nnext"'),[["a","b"],["x,y",'one "quote"\nnext']]);
  assert.ok(parseTimetable(csv(row.replace("Teacher",'"broken')),classes,subjects).issues.length);
});
test("Import validates every row, unknown/ambiguous references, limits, times, ranges, duplicate/overlap slots",()=>{
  for(const [bad,code] of [[row.replace("9H","TYPO"),"class"],[row.replace("Mathematics","TYPO"),"subject"],[row.replace("Mon","Sun"),"weekday"],[row.replace("1,2","3,2"),"values"],[row.replace("08:30","25:30"),"values"]] as const)
    assert.ok(parseTimetable(csv(row+"\n"+bad),classes,subjects).issues.some(i=>i.row===3&&i.code===code));
  assert.equal(parseTimetable(csv(row),[...classes,{...classes[0],id:id(11)}],subjects).issues[0].code,"class");
  assert.ok(parseTimetable("x".repeat(524289),classes,subjects).issues.some(i=>i.code==="limit"));
  assert.ok(parseTimetable(csv(Array(1001).fill(row).join("\n")),classes,subjects).issues.some(i=>i.code==="limit"));
  for(const other of [row,row.replace("1,2","2,3"),row.replace("1,2","3,4")]) {
    const result=parseTimetable(csv(row+"\n"+other),classes,subjects);
    assert.equal(result.issues.filter(i=>i.code==="conflict").length,2);
  }
  assert.deepEqual(parseTimetable(csv(row+"\n"+row.replace("1,2,08:30,10:10","3,4,10:15,11:45")),classes,subjects).issues,[]);
});
test("Weekly filtering uses school weekday/date boundaries and double blocks",()=>{
  assert.deepEqual(schoolWeek("2026-09-12"),{weekday:6,dates:["2026-09-07","2026-09-08","2026-09-09","2026-09-10","2026-09-11"]});
  const lesson=parseTimetable(csv(row),classes,subjects).lessons[0];
  const rows=[lesson,{...lesson,weekday:2},{...lesson,class_id:id(11)},{...lesson,effective_from:"2027-01-01"}];
  assert.equal(weeklyDay(rows,id(10),1,"2026-09-07").length,1);
  assert.equal(weeklyDay(rows,id(10),6,"2026-09-12").length,0);
  for(const locale of ["ru","kk","en"] as const) { assert.equal(phase4Copy(locale).weekdays.length,5); assert.ok(phase4Copy(locale).pdfLarge.length>10); }
});
test("Phase 4 migrations preserve history and enforce published-only access, private admin uploads and atomic weekly imports",async()=>{
  const db=await phase3Database();
  try {
    await db.exec("insert into auth.users(id) values ('"+id(1)+"'),('"+id(2)+"'),('"+id(3)+"'); update public.profiles set role='admin' where id='"+id(1)+"';");
    await db.query("insert into public.classes(id,name) values ($1,'9H')",[id(10)]);
    await db.query("insert into public.subjects(id,name) values ($1,'Mathematics')",[id(20)]);
    await db.query("insert into public.books(id,title,subject_id,file_path) values ($1,'Historical',$2,'books/history.pdf')",[id(30),id(20)]);
    await db.query("insert into public.book_rights values ($1,'Historical source','Historical permission')",[id(30)]);
    await db.query("insert into public.schedule(class_id,date,lesson_number,subject_id) values ($1,'2026-09-07',1,$2)",[id(10),id(20)]);
    for(const name of ["202609120002_phase4_books.sql","202609120003_phase4_weekly_schedule.sql"]) await db.exec(readFileSync(new URL("../supabase/migrations/"+name,import.meta.url),"utf8"));
    assert.equal((await db.query("select * from public.book_rights")).rows.length,1);
    assert.equal((await db.query("select * from public.schedule")).rows.length,1);
    await asUser(db,id(1));
    const book={id:id(31),title:"Collection",subject_id:id(20),file_path:canonicalBookPath(id(31)),publication_status:"published",page_count:3};
    await db.query("select public.save_book($1::jsonb)",[JSON.stringify(book)]);
    await db.query("select public.save_book($1::jsonb)",[JSON.stringify({...book,id:id(32),file_path:canonicalBookPath(id(32)),publication_status:"draft"})]);
    await db.query("select public.save_book($1::jsonb)",[JSON.stringify({...book,id:id(33),file_path:canonicalBookPath(id(33)),publication_status:"archived"})]);
    await db.query("insert into storage.objects(bucket_id,name) values ('book-files',$1),('book-files',$2)",[canonicalBookPath(id(31)),canonicalBookPath(id(32))]);
    await asUser(db,id(2));
    assert.equal((await db.query("select * from public.books")).rows.length,1);
    assert.equal((await db.query("select * from storage.objects")).rows.length,1);
    await assert.rejects(db.query("select public.save_book($1::jsonb)",[JSON.stringify(book)]),/Admin required/);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('book-files','books/student.pdf')"),/row-level security/);
    assert.equal((await db.query("update storage.objects set name='books/hijack.pdf' where bucket_id='book-files' returning *")).rows.length,0);
    assert.equal((await db.query("delete from storage.objects where bucket_id='book-files' returning *")).rows.length,0);
    await db.query("insert into public.bookmarks(profile_id,book_id,page_number) values ($1,$2,1)",[id(2),id(31)]);
    await db.query("insert into public.reading_progress(profile_id,book_id,page_number) values ($1,$2,1)",[id(2),id(31)]);
    await db.query("update public.reading_progress set page_number=2 where profile_id=$1",[id(2)]);
    await assert.rejects(db.query("insert into public.bookmarks(profile_id,book_id,page_number) values ($1,$2,1)",[id(2),id(32)]));
    await asUser(db,id(3)); assert.equal((await db.query("select * from public.reading_progress")).rows.length,0);
    await asUser(db,null); await assert.rejects(db.query("select * from public.books"));
    await asUser(db,id(1));
    const lessons=parseTimetable(csv(row),classes,subjects).lessons;
    const run=(rows:unknown)=>db.query("select public.import_weekly_schedule($1::jsonb)",[JSON.stringify(rows)]);
    await run(lessons); const first=await db.query("select * from public.weekly_schedule");
    await run(lessons); assert.deepEqual((await db.query("select * from public.weekly_schedule")).rows,first.rows);
    await assert.rejects(run([...lessons,...lessons]),/Duplicate/);
    await assert.rejects(run([{...lessons[0],weekday:2},{...lessons[0],lesson_start:2,lesson_end:3}]),/exclusion constraint/);
    assert.deepEqual((await db.query("select * from public.weekly_schedule")).rows,first.rows);
    await assert.rejects(run([{...lessons[0],lesson_start:3,lesson_end:4}]),/exclusion constraint/);
    await assert.rejects(run([{...lessons[0],weekday:7}]),/check constraint/);
    await assert.rejects(run([{...lessons[0],subject_id:id(999)}]),/foreign key/);
    await run([{...lessons[0],teacher:"Updated"}]); assert.equal((await db.query<{teacher:string}>("select teacher from public.weekly_schedule")).rows[0].teacher,"Updated");
    await db.query("insert into public.weekly_schedule(class_id,weekday,lesson_start,subject_id) values ($1,5,7,$2)",[id(10),id(20)]);
    assert.equal((await db.query<{lesson_end:number}>("select lesson_end from public.weekly_schedule where weekday=5")).rows[0].lesson_end,7);
    await asUser(db,id(2)); assert.equal((await db.query("select * from public.weekly_schedule")).rows.length,2);
    await assert.rejects(run(lessons),/Admin required/);
    await assert.rejects(db.query("insert into public.weekly_schedule(class_id,weekday,lesson_start,subject_id) values ($1,3,1,$2)",[id(10),id(20)]),/row-level security/);
    await asUser(db,null); await assert.rejects(db.query("select * from public.weekly_schedule"));
    await db.exec("reset role");
    assert.equal((await db.query<{public:boolean}>("select public from storage.buckets where id='book-files'")).rows[0].public,false);
  } finally { await db.close(); }
});
