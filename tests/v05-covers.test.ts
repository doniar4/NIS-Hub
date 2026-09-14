import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {v05Database} from "./helpers/v05-database";
import {asUser,fixtureId as id} from "./helpers/database";
import {coverPath} from "../src/lib/book-cover";
import {themeBootstrap} from "../src/lib/theme";
import {experienceBootstrap} from "../src/lib/experience";
test("real cover paths are canonical private images, never remote or generated covers",()=>{
 assert.equal(coverPath({id:id(30),cover_path:"books/"+id(30)+".webp"}),"books/"+id(30)+".webp");
 for(const path of [null,"https://remote.example/cover.png","../cover.png","books/"+id(31)+".webp","books/"+id(30)+".svg"])assert.equal(coverPath({id:id(30),cover_path:path}),null);
});
test("initial-document bootstrap composes safely, honors reduced motion and ends within 900 ms",()=>{
 for(const reduced of [false,true]){
  const dataset:Record<string,string>={},timers:{callback:()=>void;ms:number}[]=[];
  vm.runInNewContext(themeBootstrap+";"+experienceBootstrap,{document:{documentElement:{dataset,style:{}}},localStorage:{getItem:(key:string)=>key==="nis-sidebar"?"collapsed":"light"},matchMedia:(query:string)=>({matches:query.includes("reduced-motion")&&reduced}),setTimeout:(callback:()=>void,ms:number)=>timers.push({callback,ms})});
  assert.equal(dataset.theme,"light");assert.equal(dataset.sidebar,"collapsed");
  assert.equal(timers.length,reduced?0:1);if(!reduced){assert.equal(dataset.intro,"true");assert.equal(timers[0].ms,900);timers[0].callback();assert.equal(dataset.intro,undefined);}
 }
});
test("v0.5 covers stay private and published-only; PDF restrictions and reading ownership remain unchanged",async()=>{
 const db=await v05Database();
 try{
 await db.exec("insert into auth.users(id) values ('"+id(1)+"'),('"+id(2)+"'),('"+id(3)+"');update public.profiles set role='admin' where id='"+id(1)+"';");
 await db.query("insert into public.subjects(id,name) values ($1,'Math')",[id(20)]);
 await asUser(db,id(1));
 for(const [n,status]of [[30,"published"],[31,"draft"]] as const){
 const book={id:id(n),title:"Real test cover",subject_id:id(20),file_path:"books/"+id(n)+".pdf",publication_status:status,page_count:3};
 await db.query("select public.save_book($1::jsonb)",[JSON.stringify(book)]);
 await db.query("update public.books set cover_path=$1 where id=$2",["books/"+id(n)+".webp",id(n)]);
 await db.query("insert into storage.objects(bucket_id,name) values ('book-covers',$1),('book-files',$2)",["books/"+id(n)+".webp",book.file_path]);
 }
 await asUser(db,id(2));
 assert.equal((await db.query("select * from storage.objects where bucket_id='book-covers'")).rows.length,1);
 assert.equal((await db.query("select * from storage.objects where bucket_id='book-files'")).rows.length,1);
 await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('book-covers',$1)",["books/"+id(40)+".webp"]));
 await db.query("insert into public.bookmarks(profile_id,book_id,page_number) values ($1,$2,1)",[id(2),id(30)]);
 await db.query("insert into public.reading_progress(profile_id,book_id,page_number) values ($1,$2,2)",[id(2),id(30)]);
 await asUser(db,id(3));assert.equal((await db.query("select * from public.bookmarks")).rows.length,0);assert.equal((await db.query("select * from public.reading_progress")).rows.length,0);
 await asUser(db,null);assert.equal((await db.query("select * from storage.objects")).rows.length,0);
 await db.exec("reset role");const buckets=(await db.query<{id:string;public:boolean;file_size_limit:number;allowed_mime_types:string[]}>("select * from storage.buckets")).rows;
 assert.ok(buckets.every(b=>!b.public));const pdf=buckets.find(b=>b.id==="book-files")!;assert.equal(pdf.file_size_limit,52428800);assert.deepEqual(pdf.allowed_mime_types,["application/pdf"]);
 const avatar=buckets.find(b=>b.id==="avatars")!;assert.equal(avatar.file_size_limit,262144);assert.deepEqual(avatar.allowed_mime_types,["image/webp"]);
 }finally{await db.close();}
});
