import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { build } from "esbuild";

const apiPromise = build({
  stdin: { contents: 'export * from "./src/lib/sms/http"; export * from "./src/lib/sms/grades";', resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "esm",
  plugins: [{ name: "server-only-fixture", setup(api) {
    api.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "fixture" }));
    api.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export {};" }));
  } }],
}).then(async result => await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64")) as
  typeof import("../src/lib/sms/http") & typeof import("../src/lib/sms/grades"));

const origin = "https://sms.ura.nis.edu.kz";
const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const selection = { yearId: id(1), termId: id(2) };
const config = () => ({ origin, loginPath: "/Root/Account/Login?ReturnUrl=%2froot", secret: randomBytes(32), timeoutMs: 2000, maxBytes: 2000000 });
const authenticated = '<script>Ext.apply(App.Server,{"User":{"IsAuthenticated":true}});</script>';
const response = (body: string, type = "text/html") => new Response(body, { headers: { "content-type": type } });
const json = (data: unknown) => response(JSON.stringify({ success: true, data, ...(Array.isArray(data) ? { total: data.length } : {}) }), "application/json");

type SubjectFixture = { evaluations: number; empty?: boolean; failEvaluation?: number };
function fixture(subjects: SubjectFixture[]) {
  let inflight = 0, maxInflight = 0, evaluationCalls = 0, totalCalls = 0;
  const rows = subjects.map((subject, subjectIndex) => ({
    Id: id(100 + subjectIndex), JournalId: id(1000 + subjectIndex), Name: `Предмет ${subjectIndex + 1}`, Score: 75, Mark: 4, MarkComment: null,
    Evaluations: Array.from({ length: subject.evaluations }, (_, evaluationIndex) => ({
      Id: id(10000 + subjectIndex * 100 + evaluationIndex), Type: 1, EvalType: 1, Formula: 1,
      Name: evaluationIndex === 0 ? "Суммативное оценивание за раздел" : "Суммативное оценивание за четверть",
      ShortName: evaluationIndex === 0 ? "СОР" : "СОЧ", Percent: 50, IsCanDontConsider: false, MaxScores: {},
    })),
  }));
  const transport: typeof fetch = async (input, init) => {
    totalCalls++;
    const path = new URL(String(input)).pathname;
    const fields = new URLSearchParams(String(init?.body || ""));
    if (path === "/root") return response(authenticated);
    if (path === "/jcediary/index/0") return response('<script src="/JCEJournal/JceDiary/app.js"></script>');
    if (path === "/Ref/GetSchoolYears") return json([{ Id: id(1), Name: "2026–2027", Data: { IsActual: true } }]);
    if (path === "/Ref/GetPeriods") return json([{ Id: id(2), Name: "I четверть", Data: null }]);
    if (path === "/JceDiary/GetParallels") return json([{ Id: id(3), Name: "10", Data: null }]);
    if (path === "/JceDiary/GetKlasses") return json([{ Id: id(4), Name: "10 A", Data: null }]);
    if (path === "/JceDiary/GetStudents") return json([{ Id: id(5), Name: "Synthetic Student", Data: null }]);
    if (path === "/JceDiary/GetJceDiary") return json({ Url: `/jce/Diary/Index?shId=${id(1)}&qId=${id(2)}&pId=${id(3)}&lId=${id(4)}&studId=${id(5)}&subjects=${id(100)}` });
    if (path === "/jce/Diary/Index") return response(authenticated + '<script src="/Jce/diary/app.js"></script>');
    if (path === "/Jce/Diary/GetSubjects") return json(rows);
    assert.equal(path, "/Jce/Diary/GetResultByEvalution");
    const subjectIndex = rows.findIndex(row => row.JournalId === fields.get("journalId"));
    assert.notEqual(subjectIndex, -1);
    const evaluationIndex = rows[subjectIndex].Evaluations.findIndex(evaluation => evaluation.Id === fields.get("evalId"));
    assert.notEqual(evaluationIndex, -1);
    evaluationCalls++; inflight++; maxInflight = Math.max(maxInflight, inflight);
    try {
      await new Promise(resolve => setTimeout(resolve, 5));
      if (subjects[subjectIndex].failEvaluation === evaluationIndex) return new Response("unavailable", { status: 503 });
      if (subjects[subjectIndex].empty) return json([]);
      return json([{ Id: id(90000 + subjectIndex * 100 + evaluationIndex), Name: `Работа ${evaluationIndex + 1}`, Date: "20.09.2026", Description: null, Score: 12, MaxScore: 16, Disabled: false, Comment: null, RubricId: null }]);
    } finally { inflight--; }
  };
  return { transport, stats: () => ({ maxInflight, evaluationCalls, totalCalls }) };
}

test("SMS preload returns all assessments and marks legitimate empty subjects loaded", async () => {
  const { SmsHttp, fetchDiaryWithWorks } = await apiPromise;
  const source = fixture([{ evaluations: 3 }, { evaluations: 2, empty: true }]);
  const snapshot = await fetchDiaryWithWorks(new SmsHttp(config(), [], source.transport), undefined, selection);
  assert.equal(snapshot.subjects.length, 2);
  assert.equal(snapshot.subjects[0].assessmentsLoaded, true);
  assert.equal(snapshot.subjects[0].assessments.length, 3);
  assert.equal(snapshot.subjects[0].assessments[0].score, 12);
  assert.equal(snapshot.subjects[0].assessments[0].percent, 75);
  assert.equal(snapshot.subjects[1].assessmentsLoaded, true);
  assert.deepEqual(snapshot.subjects[1].assessments, []);
  assert.equal(source.stats().evaluationCalls, 5);
  assert.equal(source.stats().totalCalls, 15);
  assert.ok(source.stats().maxInflight <= 4);
});

test("SMS preload bounds concurrency and leaves one failed subject lazy while others succeed", async () => {
  const { SmsHttp, fetchDiaryWithWorks } = await apiPromise;
  const source = fixture([{ evaluations: 3, failEvaluation: 1 }, { evaluations: 3 }, { evaluations: 0 }]);
  const snapshot = await fetchDiaryWithWorks(new SmsHttp(config(), [], source.transport), undefined, selection);
  assert.notEqual(snapshot.subjects[0].assessmentsLoaded, true);
  assert.deepEqual(snapshot.subjects[0].assessments, [], "Partial subject results must not masquerade as complete counts");
  assert.equal(snapshot.subjects[1].assessmentsLoaded, true);
  assert.equal(snapshot.subjects[1].assessments.length, 3);
  assert.equal(snapshot.subjects[2].assessmentsLoaded, true);
  assert.deepEqual(snapshot.subjects[2].assessments, []);
  assert.ok(source.stats().maxInflight <= 4);
  assert.ok(source.stats().maxInflight > 1, "Independent evaluations should run concurrently");
});

test("SMS preload caps evaluation requests at 32 and retains remaining subjects for lazy loading", async () => {
  const { SmsHttp, fetchDiaryWithWorks } = await apiPromise;
  const source = fixture(Array.from({ length: 40 }, () => ({ evaluations: 1 })));
  const snapshot = await fetchDiaryWithWorks(new SmsHttp(config(), [], source.transport), undefined, selection);
  assert.equal(snapshot.subjects.length, 40);
  assert.equal(source.stats().evaluationCalls, 32);
  assert.equal(source.stats().totalCalls, 42);
  assert.equal(snapshot.subjects.filter(subject => subject.assessmentsLoaded).length, 32);
  const deferred = snapshot.subjects.filter(subject => !subject.assessmentsLoaded);
  assert.equal(deferred.length, 8);
  for (const subject of deferred) {
    assert.notEqual(subject.assessmentsLoaded, true);
    assert.deepEqual(subject.assessments, []);
    assert.ok(subject.sourceId && subject.journalId && subject.evaluations?.length);
  }
  assert.ok(source.stats().maxInflight <= 4);
});

test("SMS HTTP allows the preload workflow but refuses its sixty-fifth request", async () => {
  const { SmsHttp } = await apiPromise;
  let transported = 0;
  const http = new SmsHttp(config(), [], async () => { transported++; return response("ok"); });
  for (let index = 0; index < 64; index++) await http.request("/root");
  assert.equal(transported, 64);
  await assert.rejects(http.request("/root"), { code: "sms_changed" });
  assert.equal(transported, 64, "The over-budget request must not reach SMS");
});
