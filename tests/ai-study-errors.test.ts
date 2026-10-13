import test from "node:test";
import assert from "node:assert/strict";
import { studyDebug } from "../src/lib/ai-study-diagnostics";
import { geminiProvider, StudyProviderError } from "../src/lib/study-provider";
import { validateStudyResponse } from "../src/lib/ai-study";
const input = {
  variantId: "00000000-0000-4000-8000-000000000030",
  start: 1,
  end: 1,
  mode: "summary" as const,
  locale: "ru" as const,
};
const pages = [
  {
    page: 1,
    text: "A vector has a magnitude and a direction. Two equal vectors have the same magnitude and direction.",
  },
];
const answer = {
  insufficient: false,
  sections: [
    {
      kind: "overview",
      insufficient: false,
      points: [
        {
          text: "A vector has two properties.",
          evidence: [
            { page: 1, quote: "A vector has a magnitude and a direction." },
          ],
        },
      ],
    },
  ],
};
test("Gemini configuration failures are actionable and never leak raw provider details", async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 503]) {
    const provider = geminiProvider(
      { key: "private-key-fixture", model: "gemini-test", timeoutMs: 100 },
      async () =>
        Response.json(
          {
            error: {
              message:
                "private-key-fixture https://private.invalid?token=secret",
            },
          },
          { status },
        ),
    );
    await assert.rejects(
      provider.generate(input, pages),
      (error: unknown) =>
        error instanceof StudyProviderError &&
        error.code ===
          (status === 503
            ? "provider_unavailable"
            : status === 429
              ? "provider_quota"
              : status < 500
                ? "configuration"
                : "failed") &&
        error.httpStatus === status &&
        error.stage === "http" &&
        !error.message.includes("private"),
    );
  }
});
test("Small provider grammar retains strict response limits and grounded-citation validation locally", async () => {
  const provider = geminiProvider(
    { key: "fixture", model: "gemini-test", timeoutMs: 100 },
    async (_url, init) => {
      const body = JSON.parse(String(init?.body)),
        schema = JSON.stringify(body.generationConfig.responseJsonSchema);
      assert.ok(!/maxItems|minItems|minimum|additionalProperties/.test(schema));
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      assert.equal(
        body.generationConfig.responseJsonSchema.properties.sections.items.properties.kind.enum.includes(
          "overview",
        ),
        true,
      );
      return Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(answer) }] },
          },
        ],
      });
    },
  );
  assert.deepEqual(await provider.generate(input, pages), answer);
  const tooLong = structuredClone(answer);
  tooLong.sections[0].points[0].text = "x".repeat(1001);
  assert.throws(() => validateStudyResponse(tooLong, pages, "summary"));
  const invented = structuredClone(answer);
  invented.sections[0].points[0].evidence[0].page = 2;
  assert.throws(
    () => validateStudyResponse(invented, pages, "summary"),
    /citation/,
  );
  const tooMany = structuredClone(answer);
  tooMany.sections[0].points = Array.from(
    { length: 13 },
    () => answer.sections[0].points[0],
  );
  assert.throws(() => validateStudyResponse(tooMany, pages, "summary"));
});
test("AI diagnostics are development-only and discard source text, IDs, exception messages and credentials", (t) => {
  const env: Record<string, string | undefined> = process.env,
    previous = env.NODE_ENV;
  const log = t.mock.method(console, "error", () => {});
  const details = {
    code: "configuration",
    providerStage: "http",
    httpStatus: 404,
    message: "TOKEN secret PDF text",
    variantId: input.variantId,
    key: "SECRET",
    url: "https://private.invalid",
  };
  try {
    env.NODE_ENV = "production";
    studyDebug("provider-error", details);
    assert.equal(log.mock.callCount(), 0);
    env.NODE_ENV = "development";
    studyDebug("provider-error", details);
    assert.deepEqual(log.mock.calls[0].arguments, [
      "[AI Study]",
      {
        stage: "provider-error",
        code: "configuration",
        providerStage: "http",
        httpStatus: 404,
      },
    ]);
    studyDebug("SECRET", {
      code: "SECRET",
      providerStage: "SECRET",
      httpStatus: "SECRET",
    });
    assert.deepEqual(log.mock.calls[1].arguments, [
      "[AI Study]",
      { stage: "unexpected-error" },
    ]);
  } finally {
    if (previous === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previous;
  }
});

test("Gemini 503 is shared by generation and answer review without automatic retries", async () => {
  let calls = 0;
  const provider = geminiProvider(
    { key: "fixture", model: "gemini-test", timeoutMs: 100 },
    async () => {
      calls++;
      return new Response("private provider body", { status: 503 });
    },
  );
  const unavailable = (error: unknown) =>
    error instanceof StudyProviderError &&
    error.code === "provider_unavailable" &&
    error.stage === "http" &&
    error.httpStatus === 503;
  await assert.rejects(provider.generate(input, pages), unavailable);
  assert.equal(calls, 1);
  await assert.rejects(
    provider.reviewStudyAnswers("ru", pages, [
      {
        index: 0,
        question: "What is a vector?",
        answer: "A magnitude and a direction.",
      },
    ]),
    unavailable,
  );
  assert.equal(calls, 2);
});

test("Gemini uses model-compatible low thinking for generation and review, with room for complete Cyrillic JSON", async () => {
  for (const [model, expected] of [
    ["gemini-3.6-flash", { thinkingLevel: "LOW" }],
    ["gemini-3.8-flash", { thinkingLevel: "LOW" }],
    ["gemini-3.1-pro-preview", { thinkingLevel: "LOW" }],
    ["gemini-2.5-flash", { thinkingBudget: 512 }],
    ["gemini-2.5-pro", { thinkingBudget: 512 }],
    ["gemini-2.0-flash", undefined],
    ["gemini-test", undefined],
  ] as const) {
    let calls = 0;
    const provider = geminiProvider(
      { key: "fixture", model, timeoutMs: 1000 },
      async (_url, init) => {
        calls++;
        const body = JSON.parse(String(init?.body));
        assert.deepEqual(body.generationConfig.thinkingConfig, expected);
        assert.equal(body.generationConfig.maxOutputTokens, 8192);
        assert.equal(body.tools, undefined);
        return Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  { thought: true, text: "Never show this." },
                  { text: JSON.stringify(answer) },
                ],
              },
            },
          ],
        });
      },
    );
    assert.deepEqual(await provider.generate(input, pages), answer);
    // The same configuration must be used by the answer-review path.
    await assert.rejects(
      provider.reviewStudyAnswers("ru", pages, [
        { index: 0, question: "What is a vector?", answer: "A direction." },
      ]),
      { code: "failed", stage: "validate-response" },
    );
    assert.equal(calls, 2);
  }
});

test("A stalled request times out once and a later request can succeed", async () => {
  let calls = 0,
    signal: AbortSignal | undefined;
  const provider = geminiProvider(
    { key: "fixture", model: "gemini-3.6-flash", timeoutMs: 30 },
    async (_url, init) => {
      calls++;
      signal = init?.signal as AbortSignal;
      if (calls === 1) return new Promise<Response>(() => {}); // Deliberately ignores abort.
      return Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(answer) }] },
          },
        ],
      });
    },
  );
  await assert.rejects(provider.generate(input, pages), {
    code: "timeout",
    stage: "request",
  });
  assert.equal(signal?.aborted, true);
  assert.equal(calls, 1, "No hidden paid retry");
  assert.deepEqual(await provider.generate(input, pages), answer);
  assert.equal(signal?.aborted, false);
});

test("The deadline also cancels a stalled response body and applies to answer review", async () => {
  for (const review of [false, true]) {
    let cancelled = false,
      calls = 0;
    const provider = geminiProvider(
      { key: "fixture", model: "gemini-test", timeoutMs: 30 },
      async () => {
        calls++;
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"candidates":'));
            },
            cancel() {
              cancelled = true;
            },
          }),
        );
      },
    );
    await assert.rejects(
      review
        ? provider.reviewStudyAnswers("ru", pages, [
            { index: 0, question: "What is a vector?", answer: "A direction." },
          ])
        : provider.generate(input, pages),
      { code: "timeout", stage: "read-response" },
    );
    assert.equal(cancelled, true);
    assert.equal(calls, 1);
  }
});

test("Gateway failures remain actionable; truncated or ungrounded answers never become successful results", async () => {
  for (const status of [502, 504]) {
    await assert.rejects(
      geminiProvider(
        { key: "fixture", model: "gemini-test", timeoutMs: 1000 },
        async () => new Response("private detail", { status }),
      ).generate(input, pages),
      { code: "provider_unavailable", httpStatus: status },
    );
  }
  for (const finishReason of ["MAX_TOKENS", "SAFETY"]) {
    await assert.rejects(
      geminiProvider(
        { key: "fixture", model: "gemini-test", timeoutMs: 1000 },
        async () =>
          Response.json({
            candidates: [
              {
                finishReason,
                content: { parts: [{ text: JSON.stringify(answer) }] },
              },
            ],
          }),
      ).generate(input, pages),
      { code: "failed", stage: "parse-response" },
    );
  }
});
