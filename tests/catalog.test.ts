import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRoom, sortClasses, subjectMap } from "../src/lib/catalog";
import { subjectName } from "../src/lib/i18n";
test("room normalization preserves named locations and compares numeric rooms canonically", () => {
  for (const input of ["каб. 305", "305 каб", "room 305", "305"]) assert.equal(normalizeRoom(input), "305");
  for (const input of ["спортзал", "актовый зал", "кітапхана", "лаборатория"]) assert.equal(normalizeRoom(input), input);
  assert.equal(normalizeRoom(null), "");
});
test("classes sort by natural grade and arbitrary section without mutating input", () => {
  const rows = ["12F","9I","7B","10A","7A","9G"].map(name => ({name, grade:null, section:null}));
  assert.deepEqual(sortClasses(rows).map(r=>r.name), ["7A","7B","9G","9I","10A","12F"]);
  assert.equal(rows[0].name, "12F");
});
test("one canonical subject Map supports all locale labels and explicit fallback", () => {
  const row = {id:"canonical",name:"Математика",name_kz:"Математика",name_en:"Mathematics",short_name:null,created_at:""};
  const map = subjectMap([row]);
  for (const locale of ["ru","kk","en"] as const) assert.equal(subjectName(map.get("canonical"),locale), locale==="en" ? "Mathematics" : "Математика");
  assert.equal(subjectName(undefined,"en"), "");
});
<<<<<<< HEAD
test("subject labels keep each locale separate", () => {
  const law = {id:"law",name:"Fundamentals of Law",name_ru:"Основы права",name_kz:"Құқық негіздері",name_en:"Fundamentals of Law",short_name:null,created_at:""};
  assert.equal(subjectName(law,"ru"),"Основы права");
  assert.equal(subjectName(law,"kk"),"Құқық негіздері");
  assert.equal(subjectName(law,"en"),"Fundamentals of Law");
});
=======
>>>>>>> ccc1ea1b5766fdcae994fe1ed3ca7707cb081dc3
