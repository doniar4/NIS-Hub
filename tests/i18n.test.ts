import test from "node:test";
import assert from "node:assert/strict";
import { dictionaries, locales, parseLocale, subjectName } from "../src/lib/i18n";
test("all locales have complete, nonempty central dictionaries", () => {
  const keys = Object.keys(dictionaries.ru).sort();
  for (const locale of locales) {
    assert.deepEqual(Object.keys(dictionaries[locale]).sort(), keys);
    assert.ok(Object.values(dictionaries[locale]).every(value => typeof value === "string" && value.trim()));
  }
  assert.equal(parseLocale("kk"), "kk"); assert.equal(parseLocale("invalid"), "ru");
});
test("subject translations use stored metadata with explicit fallback", () => {
  const subject = { name:"Математика", name_kz:"Математика", name_en:"Mathematics" };
  assert.equal(subjectName(subject, "en"), "Mathematics");
  assert.equal(subjectName({...subject,name_kz:" "},"kk"),"Математика");
});
