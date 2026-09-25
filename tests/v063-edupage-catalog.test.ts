import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { v051Database } from "./helpers/v051-database";

test("EduPage catalog migration adds canonical subjects, 10K and aliases without grade duplicates", async () => {
  const db = await v051Database();
  try {
    await db.exec("insert into public.subjects(name,name_ru,name_kz,name_en) values ('Математика','Математика','Математика','Mathematics'),('Физика','Физика','Физика','Physics'),('Экономика','Экономика','Экономика','Economics'),('ГиП','ГиП','ГиП','GIP'),('Қазақ тілі мен әдебиеті','Казахский язык и литература','Қазақ тілі мен әдебиеті','Kazakh Language and Literature'),('Русский язык и литература','Русский язык и литература','Орыс тілі мен әдебиеті','Russian Language and Literature') on conflict(name) do nothing");
    await db.exec(readFileSync(new URL("../supabase/migrations/202609250001_v063_edupage_catalog.sql", import.meta.url), "utf8"));
    const subjects = await db.query<{ name: string }>("select name from public.subjects where name in ('IELTS','Программирование','Экономика','ГиП','Физика 11кл.') order by name");
    assert.deepEqual(subjects.rows.map(row => row.name), ["IELTS", "ГиП", "Программирование", "Экономика"]);
    const classes = await db.query<{ total: number }>("select count(*)::int total from public.classes where lower(regexp_replace(name,'\\s','','g'))='10k'");
    assert.equal(classes.rows[0].total, 1);
    const state = await db.query<{ aliases: { classes: Record<string,string>; subjects: Record<string,string> } }>("select aliases from public.edupage_sync_state where id=true");
    assert.ok(state.rows[0].aliases.classes["10k"]);
    assert.ok(state.rows[0].aliases.subjects["физика 11кл."]);
    assert.equal(state.rows[0].aliases.subjects["ielts і гр"], state.rows[0].aliases.subjects["ielts ii гр"]);
    assert.equal(state.rows[0].aliases.subjects["м10"], state.rows[0].aliases.subjects["математика 7ч"]);
  } finally {
    await db.close();
  }
});
