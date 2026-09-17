import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WeeklyLessonList, WeeklyScheduleBrowser } from "../src/components/weekly-schedule";
import { LibraryBrowser } from "../src/components/library-browser";
import { LocaleProvider } from "../src/components/locale-provider";
import { dictionaries, subjectName, type Locale } from "../src/lib/i18n";
import { filterBooks, initialLibraryFilters } from "../src/lib/library";
import { parseTimetable } from "../src/lib/timetable-import";
import { books, classes, subjects } from "./browser/fixtures";
import type { WeeklyLesson } from "../src/lib/database.types";
const row: WeeklyLesson = { id:"lesson-fixture",class_id:classes[1].id,weekday:1,lesson_start:1,lesson_end:2,
  subject_id:subjects[0].id,start_time:"08:30",end_time:"10:10",teacher:"Never display this teacher",room:"305",
  effective_from:null,effective_to:null,created_at:"",updated_at:"" };
// createElement supplies required children through its third argument.
const render = (locale: Locale, child: React.ReactNode) => renderToStaticMarkup(createElement(LocaleProvider,{locale} as Parameters<typeof LocaleProvider>[0],child));
test("Home and Schedule subject links use canonical subject and lesson class across RU/KZ/EN; teachers stay hidden",()=>{
  for(const locale of ["ru","kk","en"] as const){
    for(const child of [
      createElement(WeeklyLessonList,{lessons:[row],subjects,grade:classes[1].grade}),
      createElement(WeeklyScheduleBrowser,{lessons:[row],subjects,classes,initialClassId:row.class_id,date:"2026-09-07"}),
    ]){
      const html=render(locale,child);
      const href=html.match(/href="([^"]+)"/)?.[1].replace(/&amp;/g,"&");
      assert.ok(href);
      const url=new URL(href,"https://fixture.invalid");
      assert.equal(url.pathname,"/library");
      assert.deepEqual(initialLibraryFilters(Object.fromEntries(url.searchParams),String(classes[0].grade)),
        {q:"",subject:row.subject_id,grade:String(classes[1].grade)});
      assert.ok(html.includes(subjectName(subjects[0],locale)));
      assert.doesNotMatch(html,/Never display this teacher/);
      assert.ok(html.includes("08:30") && html.includes("10:10") && html.includes("305"));
      const filtered=filterBooks(books,initialLibraryFilters(Object.fromEntries(url.searchParams)));
      assert.ok(filtered.length>1);assert.ok(filtered.every(book=>book.subject_id===row.subject_id&&book.grade===classes[1].grade));
    }
  }
});
test("A timetable subject with no published catalog matches uses the normal localized Library empty state",()=>{
  const initial=initialLibraryFilters({subject:subjects[2].id,grade:String(classes[0].grade)});
  assert.deepEqual(filterBooks(books,initial),[]);
  for(const locale of ["ru","kk","en"] as const){
    const html=render(locale,createElement(LibraryBrowser,{initial,books,classes,subjects,truncated:false}));
    assert.ok(html.includes(dictionaries[locale].noMaterials));assert.ok(html.includes(dictionaries[locale].noMaterialsHint));
    assert.doesNotMatch(html,/role="alert"/);
  }
});
test("Teacher remains accepted by the timetable importer, including blank values",()=>{
  const header="class,weekday,lesson_start,lesson_end,start_time,end_time,subject,teacher,room\n";
  for(const teacher of ["Teacher retained in data",""]){
    const result=parseTimetable(header+classes[0].name+",Mon,1,2,08:30,10:10,"+subjects[0].name+","+teacher+",305",classes,subjects);
    assert.deepEqual(result.issues,[]);assert.equal(result.lessons[0].teacher,teacher||null);
  }
});
