import test from "node:test";
import assert from "node:assert/strict";
import { v051Database } from "./helpers/v051-database";
import { asUser, fixtureId as id } from "./helpers/database";
import { withMessageAvatars } from "../src/lib/message-avatars";
import {
  captureReaderAnchor,
  readerAnchorScroll,
} from "../src/lib/reader-controls";
import { studyRangeEnd } from "../src/lib/study-range";

test("DM avatar SQL permits visible peers only and preserves own message attribution", async () => {
  const db = await v051Database();
  try {
    await db.exec(`insert into auth.users(id) values('${id(1)}'),('${id(2)}'),('${id(3)}');
      update profiles set display_name='Student-'||right(id::text,1);
      insert into storage.objects(bucket_id,name) values('avatars','${id(2)}/avatar.webp');
      update profiles set avatar_path='${id(2)}/avatar.webp' where id='${id(2)}';`);
    await asUser(db, id(1));
    assert.equal(
      (
        await db.query(
          "select * from storage.objects where bucket_id='avatars'",
        )
      ).rows.length,
      0,
    );
    const thread = (
      await db.query<{ id: string }>("select start_dm('Student-2') id")
    ).rows[0].id;
    await db.query("select send_dm($1,'From me',$2)", [thread, id(90)]);
    const inbox = (
      await db.query<{ peer_avatar_path: string; last_sender_id: string }>(
        "select * from dm_inbox_v2()",
      )
    ).rows[0];
    assert.equal(inbox.peer_avatar_path, `${id(2)}/avatar.webp`);
    assert.equal(inbox.last_sender_id, id(1));
    assert.equal(
      (
        await db.query(
          "select * from storage.objects where bucket_id='avatars'",
        )
      ).rows.length,
      1,
    );
    await asUser(db, id(3));
    assert.equal(
      (
        await db.query(
          "select * from storage.objects where bucket_id='avatars'",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update storage.objects set updated_at=now() where bucket_id='avatars' returning id",
        )
      ).rows.length,
      0,
    );
    await asUser(db, id(1));
    await db.query("select set_dm_hidden($1,true)", [thread]);
    assert.equal(
      (
        await db.query(
          "select * from storage.objects where bucket_id='avatars'",
        )
      ).rows.length,
      0,
    );
    await db.query("select start_dm('Student-2')");
    await db.query("select set_user_block($1,true)", [id(2)]);
    assert.equal(
      (
        await db.query<{ peer_avatar_path: null }>(
          "select * from dm_inbox_v2()",
        )
      ).rows[0].peer_avatar_path,
      null,
    );
    assert.equal(
      (
        await db.query(
          "select * from storage.objects where bucket_id='avatars'",
        )
      ).rows.length,
      0,
    );
    await asUser(db, null);
    await assert.rejects(
      db.query("select * from dm_inbox_v2()"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("avatars reuse signed URLs between inbox polls, refresh after expiry/version changes and withhold blocked peers", async () => {
  const row = {
    id: id(80),
    peer_id: id(72),
    peer_name: "Peer",
    last_body: null,
    last_at: "2026-10-07T00:00:00Z",
    last_deleted: false,
    unread: 0,
    blocked: false,
    peer_avatar_path: `${id(72)}/avatar.webp`,
    peer_avatar_updated_at: "v1",
  };
  let calls = 0;
  const sign = async (paths: string[], ttl: number) => {
    calls++;
    assert.equal(ttl, 600);
    assert.deepEqual(paths, [row.peer_avatar_path]);
    return {
      data: paths.map((path) => ({
        path,
        signedUrl: `https://fixture.invalid/avatar?version=${calls}`,
      })),
    };
  };
  const first = await withMessageAvatars([row], sign, 1000);
  assert.ok(first[0].peer_avatar_url);
  assert.equal(
    (await withMessageAvatars([row], sign, 11000))[0].peer_avatar_url,
    first[0].peer_avatar_url,
  );
  assert.equal(calls, 1);
  assert.equal(
    (await withMessageAvatars([{ ...row, blocked: true }], sign, 11000))[0]
      .peer_avatar_url,
    null,
  );
  assert.equal(calls, 1);
  assert.notEqual(
    (
      await withMessageAvatars(
        [{ ...row, peer_avatar_updated_at: "v2" }],
        sign,
        12000,
      )
    )[0].peer_avatar_url,
    first[0].peer_avatar_url,
  );
  await withMessageAvatars([row], sign, 602000);
  assert.equal(calls, 3);
  const failure = await withMessageAvatars(
    [{ ...row, peer_avatar_updated_at: "failed" }],
    async () => {
      throw new Error("Storage offline");
    },
    603000,
  );
  assert.equal(failure[0].peer_avatar_url, null);
});

test("unverified cleanup deletes only stale pending email registrations, cascades profiles and survives retained content", async () => {
  const db = await v051Database();
  try {
    for (let n = 1; n <= 9; n++)
      await db.query(
        "insert into auth.users(id,email,created_at) values($1,$2,now()-interval '4 days')",
        [id(n), `fixture-${n}@example.invalid`],
      );
    await db.exec(`update auth.users set created_at=now()-interval '2 days' where id='${id(2)}';
      update auth.users set email_confirmed_at=now() where id='${id(3)}';
      update auth.users set phone_confirmed_at=now() where id='${id(4)}';
      update auth.users set last_sign_in_at=now() where id='${id(5)}';
      update auth.users set is_anonymous=true where id='${id(6)}';
      update auth.users set raw_app_meta_data='{"provider":"google"}' where id='${id(7)}';
      update profiles set role='admin' where id='${id(8)}';
      create table retained_fixture(owner_id uuid references auth.users(id));
      insert into retained_fixture values('${id(9)}');`);
    await asUser(db, id(2));
    await assert.rejects(
      db.query("select private.cleanup_unverified_accounts()"),
      /permission denied/,
    );
    await asUser(db, null);
    await assert.rejects(
      db.query("select private.cleanup_unverified_accounts()"),
      /permission denied/,
    );
    await db.exec("reset role");
    const removed = await db.query<{ count: number }>(
      "select private.cleanup_unverified_accounts() count",
    );
    assert.equal(removed.rows[0].count, 1);
    assert.equal(
      (await db.query("select * from auth.users where id=$1", [id(1)])).rows
        .length,
      0,
    );
    assert.equal(
      (await db.query("select * from profiles where id=$1", [id(1)])).rows
        .length,
      0,
    );
    assert.equal((await db.query("select * from auth.users")).rows.length, 8);
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select private.cleanup_unverified_accounts() count",
        )
      ).rows[0].count,
      0,
    );
  } finally {
    await db.close();
  }
});

test("zoom retains a centered or panned document point; study range stays valid when its first page changes", () => {
  const view = { left: 10, top: 20, width: 400, height: 600 };
  const page = { left: 20, top: 30, width: 380, height: 760 };
  const anchor = captureReaderAnchor(view, page);
  const zoomed = { ...page, width: 760, height: 1520 };
  const next = readerAnchorScroll(anchor, view, zoomed, 0, 0);
  assert.equal(next.left, 190);
  assert.equal(next.top, 290);
  assert.equal(
    readerAnchorScroll(anchor, { ...view, width: 500 }, zoomed, 0, 0).left,
    140,
  );
  const panned = { left: -200, top: -180, width: 800, height: 1600 };
  const pannedAnchor = captureReaderAnchor(view, panned);
  assert.ok(
    Math.abs(
      readerAnchorScroll(pannedAnchor, view, panned, 220, 210).left - 220,
    ) < 0.01,
  );
  assert.ok(
    Math.abs(
      readerAnchorScroll(pannedAnchor, view, panned, 220, 210).top - 210,
    ) < 0.01,
  );
  assert.equal(studyRangeEnd(8, 3, 10, 100), 8);
  assert.equal(studyRangeEnd(3, 30, 10, 100), 12);
  assert.equal(studyRangeEnd(98, 110, 10, 100), 100);
});
