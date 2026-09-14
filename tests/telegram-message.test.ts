import test from "node:test";
import assert from "node:assert/strict";
import {createTicketNotice,formatTicketNotice,TELEGRAM_PREVIEW_LIMIT} from "../src/lib/telegram-message";
import {ticketCategories} from "../src/lib/support";
import {v05Copy} from "../src/lib/v05-copy";

const input = {
 id:"00000000-0000-4000-8000-000000000030", category:"platform" as const,
 createdAt:"2026-09-14T10:00:00Z",title:"Не открывается книга",description:"Проверьте страницу 2.",displayName:" Айдана ",
};
test("Telegram summary uses Russian heading/categories, trusted display name and Asia/Oral time",()=>{
 for(const category of ticketCategories){
  const text=formatTicketNotice(createTicketNotice({...input,category}),"https://school.example");
  assert.match(text,/<b>NIS Hub · Новый тикет<\/b>/);
  assert.ok(text.includes(v05Copy("ru").categories[category]));
  assert.ok(text.includes(input.title));assert.ok(text.includes(input.description));
  assert.match(text,/<b>Автор:<\/b> Айдана/);
  assert.match(text,/14 сентября 2026/);assert.match(text,/15:00.*Asia\/Oral/);
  assert.ok(text.includes('href="https://school.example/support/'+input.id+'"'));
 }
 const nextDay=formatTicketNotice(createTicketNotice({...input,createdAt:"2026-09-14T21:30:00Z"}),"https://school.example");
 assert.match(nextDay,/15 сентября 2026/);assert.match(nextDay,/02:30/);
});
test("preview is Unicode-safe and at most 400 characters including ellipsis; full description is never retained",()=>{
 for(const char of ["a","қ","😀","&"]){
  for(const length of [0,1,399,400,401,5000]){
   const description=char.repeat(length);
   const notice=createTicketNotice({...input,description});
   assert.equal(Array.from(notice.preview).length,Math.min(length,TELEGRAM_PREVIEW_LIMIT));
   assert.equal(notice.preview,length>400?char.repeat(399)+"…":description);
   assert.equal("description" in notice,false);
   assert.equal(notice.preview.includes("\ufffd"),false);
  }
 }
 const notice=createTicketNotice({...input,description:"a".repeat(401)+"PRIVATE_TAIL"});
 assert.ok(!JSON.stringify(notice).includes("PRIVATE_TAIL"));
 // Bounds also apply to direct transport callers, not only the action's builder.
 const text=formatTicketNotice({...notice,preview:"x".repeat(400)+"PRIVATE_TAIL"},"https://school.example");
 assert.ok(!text.includes("PRIVATE_TAIL"));assert.ok(text.includes("x".repeat(399)+"…"));
});
test("user HTML, Markdown, ampersands and quotes cannot create Telegram formatting or links",()=>{
 const markup='<b>тема & "текст"</b> _x_ [y]';
 const text=formatTicketNotice(createTicketNotice({...input,title:markup,description:markup,displayName:"<i>Алия</i>"}),"https://school.example");
 assert.ok(text.includes('&lt;b&gt;тема &amp; &quot;текст&quot;&lt;/b&gt; _x_ [y]'));
 assert.ok(text.includes("&lt;i&gt;Алия&lt;/i&gt;"));
 assert.equal((text.match(/<a /g)??[]).length,1);
 assert.ok(!text.includes("<i>"));assert.ok(!text.includes("<b>тема"));
});
test("notice omits unavailable/email names, strips line/bidi controls and minimizes obvious secrets and URLs",()=>{
 for(const displayName of [undefined,null,"  ","student@example.org","https://private.example/avatar?token=synthetic"]){
  assert.doesNotMatch(formatTicketNotice(createTicketNotice({...input,displayName}),"https://school.example"),/<b>Автор:/);
 }
 const notice=createTicketNotice({...input,displayName:"Алия\n\u202e Жан",description:'Откройте https://private.example/file?token=synthetic student@example.org password=synthetic-pass token=synthetic-key'});
 assert.equal(notice.displayName,"Алия Жан");
 for(const secret of ["private.example","synthetic","student@example.org"])assert.ok(!notice.preview.includes(secret));
 assert.ok(notice.preview.includes("[скрыто]"));
 assert.equal(createTicketNotice({...input,displayName:"a".repeat(100)}).displayName?.length,60);
 assert.equal(createTicketNotice({...input,title:"a".repeat(200)}).title.length,120);
 assert.throws(()=>formatTicketNotice({...createTicketNotice(input),id:'../admin?token=injected'},"https://school.example"));
});
