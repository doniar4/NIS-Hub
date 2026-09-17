import test from "node:test";
import assert from "node:assert/strict";
import {v051Database} from "./helpers/v051-database";
import {asUser,fixtureId as id} from "./helpers/database";
import {classGrade,editionLanguage,librarySubjectHref} from "../src/lib/book-model";

test("class letters resolve to one grade; editions and Library links use canonical IDs",()=>{
 for(const name of ["9A","9H","9I","9Н"])assert.equal(classGrade({name,grade:null}),9);
 assert.equal(classGrade({name:"9H",grade:9}),9);assert.equal(classGrade({name:"Unknown",grade:null}),null);
 assert.equal(classGrade({name:"123",grade:null}),null);
 const url=new URL(librarySubjectHref(id(20),9),"https://school.example");
 assert.equal(url.searchParams.get("grade"),"9");assert.equal(url.searchParams.get("subject"),id(20));assert.equal(url.searchParams.has("classId"),false);
 assert.equal(editionLanguage("kk"),"kz");assert.equal(editionLanguage("Русский"),"ru");assert.equal(editionLanguage("unknown"),"und");
});
test("subject correction migration translates known legacy English labels",async()=>{
 const db=await v051Database(async db=>{
  await db.query("insert into public.subjects(id,name,name_kz,name_en) values ($1,'Fundamentals of Law','Fundamentals of Law','Fundamentals of Law')",[id(20)]);
 });
 try {
  const law=(await db.query<{name_ru:string;name_kz:string;name_en:string}>("select name_ru,name_kz,name_en from public.subjects where id=$1",[id(20)])).rows[0];
  assert.deepEqual(law,{name_ru:"Основы права",name_kz:"Құқық негіздері",name_en:"Fundamentals of Law"});
 } finally { await db.close(); }
});
test("v0.5.1 migrations preserve legacy PDFs/covers and reading data; editions remain private and isolated",async()=>{
 const db=await v051Database(async db=>{
  await db.exec("insert into auth.users(id) values ('"+id(1)+"'),('"+id(2)+"'),('"+id(3)+"'); update public.profiles set role='admin' where id='"+id(1)+"';");
  await db.query("insert into public.classes(id,name,grade) values ($1,'9H',9)",[id(10)]);
  await db.query("insert into public.subjects(id,name) values ($1,'Математика')",[id(20)]);
  await db.query("insert into public.books(id,title,subject_id,class_id,file_path,cover_path,language,page_count,publication_status) values ($1,'Textbook',$2,$3,'legacy/book.pdf','books/cover.webp','Русский',3,'published')",[id(30),id(20),id(10)]);
  await db.query("insert into public.bookmarks(profile_id,book_id,page_number) values ($1,$2,2)",[id(2),id(30)]);
  await db.query("insert into public.reading_progress(profile_id,book_id,page_number) values ($1,$2,3)",[id(2),id(30)]);
  await db.query("insert into storage.objects(bucket_id,name) values ('book-files','legacy/book.pdf')");
 });
 try{
  const book=(await db.query<{grade:number;class_id:string}>("select * from public.books")).rows[0];
  assert.equal(book.grade,9);assert.equal(book.class_id,id(10));
  const variant=(await db.query<{id:string;language:string;storage_path:string;cover_path:string}>("select * from public.book_variants")).rows[0];
  assert.equal(variant.id,id(30));assert.equal(variant.language,"ru");assert.equal(variant.storage_path,"legacy/book.pdf");assert.equal(variant.cover_path,"books/cover.webp");
  await asUser(db,id(2));assert.equal((await db.query("select * from public.variant_bookmarks")).rows.length,1);
  assert.equal((await db.query<{page_number:number}>("select * from public.variant_reading_progress")).rows[0].page_number,3);
  await asUser(db,id(3));assert.equal((await db.query("select * from public.variant_bookmarks")).rows.length,0);
  await assert.rejects(db.query("insert into public.variant_reading_progress(profile_id,book_variant_id,page_number) values ($1,$2,1)",[id(2),id(30)]));
  await assert.rejects(db.query("insert into public.book_variants(book_id,language,storage_path) values ($1,'kz','books/new.pdf')",[id(30)]));
  await asUser(db,id(1));
  await db.query("insert into public.book_variants(id,book_id,language,storage_path,page_count,publication_status) values ($1,$2,'kz','books/kz.pdf',2,'published')",[id(31),id(30)]);
  await db.query("insert into storage.objects(bucket_id,name) values ('book-files','books/kz.pdf')");
  await assert.rejects(db.query("insert into public.book_variants(book_id,language,storage_path) values ($1,'kz','books/duplicate.pdf')",[id(30)]));
  await asUser(db,id(2));
  await db.query("insert into public.variant_reading_progress(profile_id,book_variant_id,page_number) values ($1,$2,1)",[id(2),id(31)]);
  assert.equal((await db.query("select * from public.variant_reading_progress")).rows.length,2);
  await assert.rejects(db.query("insert into public.variant_bookmarks(profile_id,book_variant_id,page_number) values ($1,$2,3)",[id(2),id(31)]));
  assert.equal((await db.query("select * from storage.objects where bucket_id='book-files'")).rows.length,2);
  await asUser(db,id(1));await db.query("update public.book_variants set publication_status='draft' where id=$1",[id(31)]);
  await asUser(db,id(2));assert.equal((await db.query("select * from storage.objects where bucket_id='book-files'")).rows.length,1);
  await asUser(db,null);await assert.rejects(db.query("select * from public.book_variants"));
  assert.equal((await db.query("select * from storage.objects")).rows.length,0);
  await db.exec("reset role");
  assert.equal((await db.query("select * from public.bookmarks")).rows.length,1);
  assert.equal((await db.query("select * from public.reading_progress")).rows.length,1);
 }finally{await db.close();}
});
