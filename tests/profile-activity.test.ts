import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { asUser, fixtureId } from "./helpers/database";
import { activityDate } from "../src/lib/activity-date";
import { parseProfileActivity } from "../src/lib/profile-activity";
import {
  buildGrid,
  computeStats,
  dayMs,
} from "../src/components/ui/contribution-skyline";
import { activityNoun } from "../src/lib/skyline-copy";

test("Activity days use Oral time; a visit around midnight starts a new day", () => {
  assert.equal(activityDate(new Date("2026-10-11T18:59:59Z")), "2026-10-11");
  assert.equal(activityDate(new Date("2026-10-11T19:00:00Z")), "2026-10-12");
  const parsed = parseProfileActivity(
    [{ day: "2026-10-12", views: 2 }],
    "2026-10-12",
  );
  assert.deepEqual(parsed.days, [{ date: "2026-10-12", count: 2 }]);
  for (const raw of [
    [{ day: "2026-02-30", views: 1 }],
    [{ day: "2026-10-12", views: -1 }],
    [{ day: "2026-10-12", views: 1.5 }],
  ])
    assert.throws(() => parseProfileActivity(raw));
});

test("The supplied skyline counts actual views separately from daily visit streaks", () => {
  const end = dayMs("2026-10-12");
  const data = [
    { date: "2026-10-07", count: 10 },
    { date: "2026-10-08", count: 2 },
    { date: "2026-10-10", count: 1 },
    { date: "2026-10-11", count: 4 },
    { date: "2026-10-12", count: 2 },
  ];
  for (const weekStart of [0, 1]) {
    const stats = computeStats(buildGrid(data, end, weekStart).cells);
    assert.equal(stats.total, 19);
    assert.deepEqual(stats.busiest, { count: 10, date: "2026-10-07" });
    assert.deepEqual(stats.current, {
      days: 3,
      start: "2026-10-10",
      end: "2026-10-12",
    });
    assert.equal(stats.longest.days, 3);
  }
  assert.equal(
    computeStats(
      buildGrid(
        data.filter((d) => d.date !== "2026-10-12"),
        end,
        1,
      ).cells,
    ).current.days,
    2,
    "Today is not over yet; yesterday's streak stays alive",
  );
  assert.equal(
    computeStats(
      buildGrid(
        data.filter((d) => d.date < "2026-10-11"),
        end,
        1,
      ).cells,
    ).current.days,
    0,
    "Two absent days break the streak",
  );
  assert.equal(
    computeStats(buildGrid([], end, 1).cells).total,
    0,
    "An empty real history is never filled with demo data",
  );
  assert.equal(activityNoun(1, ["день", "дня", "дней"], "ru"), "день");
  assert.equal(activityNoun(2, ["день", "дня", "дней"], "ru"), "дня");
  assert.equal(activityNoun(11, ["день", "дня", "дней"], "ru"), "дней");
});

test("Profile aggregation exposes only the authenticated owner's daily counts and preserves private raw activity", async () => {
  const db = new PGlite(),
    owner = fixtureId(701),
    other = fixtureId(702);
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema public,auth to anon,authenticated;
   create table public.user_activity_logs(id uuid primary key default gen_random_uuid(),user_id uuid,path text,user_agent text,created_at timestamptz not null default now());
   alter table public.user_activity_logs enable row level security;
   grant select on public.user_activity_logs to authenticated;
   create policy "Admins view activity logs" on public.user_activity_logs for select to authenticated using(false);
   create function public.log_user_activity(p_path text,p_user_agent text default null) returns void language plpgsql security definer set search_path='' as $$
    begin if auth.uid() is null then return;end if;insert into public.user_activity_logs(user_id,path,user_agent) values(auth.uid(),left(p_path,255),left(p_user_agent,255));end $$;
   grant execute on function public.log_user_activity(text,text) to authenticated;`);
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/202610120003_profile_activity.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const {
      rows: [{ today, yesterday }],
    } = await db.query<{ today: string; yesterday: string }>(
      "select ((now() at time zone 'Asia/Oral')::date)::text today,((now() at time zone 'Asia/Oral')::date-1)::text yesterday",
    );
    const midnight = `(('${today}'::date)::timestamp at time zone 'Asia/Oral')`;
    await db.query(
      `insert into public.user_activity_logs(user_id,path,user_agent,created_at) values
   ($1,'/profile','PRIVATE-DEVICE',${midnight}-interval '1 second'),
   ($1,'/library','PRIVATE-DEVICE',${midnight}+interval '1 second'),
   ($1,'/messages','PRIVATE-DEVICE',${midnight}+interval '23 hours'),
   ($1,'/old','PRIVATE-DEVICE',${midnight}-interval '371 days'),
   ($2,'/other-private','OTHER-DEVICE',${midnight}+interval '1 second')`,
      [owner, other],
    );
    await asUser(db, owner);
    assert.deepEqual(
      (await db.query("select * from public.user_activity_logs")).rows,
      [],
    );
    const result = await db.query<{ day: string; views: number }>(
      "select day::text,views::int from public.profile_activity_year()",
    );
    assert.deepEqual(result.rows, [
      { day: yesterday, views: 1 },
      { day: today, views: 2 },
    ]);
    assert.doesNotMatch(
      JSON.stringify(result.rows),
      /PRIVATE|DEVICE|profile|library|messages/,
    );
    await db.query(
      "select public.log_user_activity('/profile','PRIVATE-DEVICE')",
    );
    assert.equal(
      (
        await db.query<{ views: number }>(
          "select views::int from public.profile_activity_year() where day=$1",
          [today],
        )
      ).rows[0].views,
      3,
    );
    await assert.rejects(
      db.query("select public.profile_activity_year($1)", [other]),
      /does not exist/,
    );
    await assert.rejects(
      db.query(
        "insert into public.user_activity_logs(user_id,path) values($1,'/spoof')",
        [other],
      ),
      /permission denied/,
    );
    await asUser(db, other);
    assert.deepEqual(
      (await db.query("select views::int from public.profile_activity_year()"))
        .rows,
      [{ views: 1 }],
    );
    await asUser(db, null);
    await assert.rejects(
      db.query("select * from public.profile_activity_year()"),
      /permission denied/,
    );
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int from public.user_activity_logs",
        )
      ).rows[0].count,
      6,
      "Migration never rewrites history",
    );
  } finally {
    await db.close();
  }
});
