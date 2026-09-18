import test from "node:test";
import assert from "node:assert/strict";
import { v051Database } from "./helpers/v051-database";
import { asUser, fixtureId as id } from "./helpers/database";
import { parseDiary, averagePercent, DIARY_MAX_BYTES } from "../src/lib/diary";
import { subjectName } from "../src/lib/i18n";

test("diary parses multilingual HTML and CSV without executing markup", () => {
  const csv =
    'subject,date,score,max,type\n"Art, studio",2026-09-10,8,10,Formative';
  assert.deepEqual(parseDiary(csv), [
    {
      subject: "Art, studio",
      date: "2026-09-10",
      score: 8,
      max: 10,
      type: "Formative",
    },
  ]);
  const html =
    '<script>throw new Error("must not execute")</script><img src="https://invalid.test/tracker"><table><tr><th>Предмет</th><th>Дата</th><th>Балл</th></tr><tr><td><strong>Основы права</strong></td><td>11.09.2026</td><td>7/10</td></tr></table>';
  const rows = parseDiary(html);
  assert.equal(rows[0].score, 7);
  assert.equal(rows[0].date, "2026-09-11");
  assert.equal(averagePercent(rows), 70);
  assert.equal(averagePercent([]), null);
  assert.equal(
    parseDiary(
      "<table><tr><th>Пән</th><th>Күні</th><th>Балл</th><th>Ең жоғары балл</th></tr><tr><td>Өнер</td><td>2026-09-12</td><td>8</td><td>10</td></tr></table>",
    )[0].subject,
    "Өнер",
  );
});
test("diary rejects invalid dates, missing maxima, excessive scores and oversized files", () => {
  for (const row of [
    "Math,2026-02-30,8,10",
    "Math,2026-09-10,11,10",
    "Math,2026-09-10,8,0",
    "Math,2026-09-10,,10",
    "Math,2026-09-10,8,",
  ])
    assert.throws(() => parseDiary("subject,date,score,max\n" + row));
  assert.throws(() => parseDiary("x".repeat(DIARY_MAX_BYTES + 1)));
  assert.throws(() =>
    parseDiary("<table><tr><td>Unsupported portal layout</td></tr></table>"),
  );
});
test("Law and Art remain translated before the cloud migration is installed", () => {
  for (const [name, ru, kk, en] of [
    [
      "Fundamentals of Law",
      "Основы права",
      "Құқық негіздері",
      "Fundamentals of Law",
    ],
    ["Искусство", "Искусство", "Өнер", "Art"],
  ]) {
    const subject = { name, name_ru: name, name_kz: name, name_en: name };
    assert.equal(subjectName(subject, "ru"), ru);
    assert.equal(subjectName(subject, "kk"), kk);
    assert.equal(subjectName(subject, "en"), en);
  }
});
test("DM database enforces unique names, membership, idempotency, notifications and read isolation", async () => {
  const db = await v051Database();
  try {
    for (const n of [1, 2, 3])
      await db.query("insert into auth.users(id) values($1)", [id(n)]);
    await db.query(
      "update public.profiles set display_name='Aruzhan.N' where id=$1",
      [id(1)],
    );
    await db.query(
      "update public.profiles set display_name='Daniyar.S' where id=$1",
      [id(2)],
    );
    await db.query(
      "update public.profiles set display_name='Madi.K' where id=$1",
      [id(3)],
    );
    await assert.rejects(
      db.query(
        "update public.profiles set display_name=' aruzhan.n ' where id=$1",
        [id(3)],
      ),
    );
    await asUser(db, id(1));
    const thread = (
      await db.query<{ id: string }>(
        "select public.start_dm('dANIYAR.s') as id",
      )
    ).rows[0].id;
    assert.equal(
      (
        await db.query<{ id: string }>(
          "select public.start_dm('Daniyar.S') as id",
        )
      ).rows[0].id,
      thread,
    );
    await assert.rejects(db.query("select public.start_dm('Aruzhan.N')"));
    const message = (
      await db.query<{ id: string }>(
        "select public.send_dm($1,'Сәлем!',$2) as id",
        [thread, id(40)],
      )
    ).rows[0].id;
    assert.equal(
      (
        await db.query<{ id: string }>(
          "select public.send_dm($1,'Сәлем!',$2) as id",
          [thread, id(40)],
        )
      ).rows[0].id,
      message,
    );
    await assert.rejects(
      db.query("select public.send_dm($1,'Changed retry',$2)", [
        thread,
        id(40),
      ]),
    );
    assert.equal(
      (await db.query("select * from public.web_notifications")).rows.length,
      0,
    );
    await asUser(db, id(2));
    const inbox = (
      await db.query<{ peer_name: string; unread: number }>(
        "select * from public.dm_inbox()",
      )
    ).rows[0];
    assert.equal(inbox.peer_name, "Aruzhan.N");
    assert.equal(Number(inbox.unread), 1);
    const notification = (
      await db.query<{ id: string }>("select * from public.notification_feed()")
    ).rows[0];
    assert.ok(notification.id);
    assert.equal(
      (await db.query("select * from public.direct_messages")).rows.length,
      1,
    );
    await assert.rejects(
      db.query(
        "insert into public.direct_messages(thread_id,sender_id,body,client_id) values($1,$2,'forged',$3)",
        [thread, id(1), id(41)],
      ),
    );
    await asUser(db, id(3));
    for (const table of ["dm_threads", "direct_messages", "web_notifications"])
      assert.equal(
        (await db.query("select * from public." + table)).rows.length,
        0,
      );
    assert.equal(
      (await db.query("select * from public.dm_inbox()")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.send_dm($1,'intrusion',$2)", [thread, id(42)]),
    );
    await assert.rejects(
      db.query("select public.read_dm($1,$2)", [thread, message]),
    );
    await db.query("select public.dismiss_notification($1)", [notification.id]);
    await asUser(db, id(2));
    assert.equal(
      (
        await db.query<{ read_at: string | null }>(
          "select read_at from public.web_notifications",
        )
      ).rows[0].read_at,
      null,
    );
    await db.query("select public.read_dm($1,$2)", [thread, message]);
    assert.equal(
      Number(
        (await db.query<{ unread: number }>("select * from public.dm_inbox()"))
          .rows[0].unread,
      ),
      0,
    );
    assert.ok(
      (
        await db.query<{ read_at: string | null }>(
          "select read_at from public.web_notifications",
        )
      ).rows[0].read_at,
    );
    await asUser(db, null);
    await assert.rejects(db.query("select public.dm_inbox()"));
    await assert.rejects(db.query("select * from public.direct_messages"));
  } finally {
    await db.close();
  }
});
