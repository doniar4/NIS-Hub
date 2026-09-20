import { answerReviewInstructions,answerReviewJsonSchema,validateAnswerReview,type AnswerReview,type AnswerReviewRequest } from "./study-answer-review";
import {
  STUDY_SECTIONS,
  studyInstructions,
  validateStudyResponse,
  type SourcePage,
  type StudyInput,
  type StudyResponse
} from "./ai-study";

export interface StudyProvider {
  reviewStudyAnswers(locale:StudyInput["locale"], pages:SourcePage[], answers:AnswerReviewRequest[]):Promise<AnswerReview>;
  generate(input: StudyInput, pages: SourcePage[]): Promise<StudyResponse>;
}

export class StudyProviderError extends Error {
  constructor(readonly code: "provider_quota" | "configuration" | "timeout" | "failed", readonly stage: "configuration" | "request" | "http" | "read-response" | "parse-response" | "validate-response" = "request", readonly httpStatus?: number) {
    super(code);
  }
}

// Keep the provider grammar small: nested numeric/array bounds triggered HTTP 400.
// Strict limits and exact source citations are still enforced by validateStudyResponse.
const responseJsonSchema = {
  type: "object",
  properties: {
    insufficient: { type: "boolean" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [...STUDY_SECTIONS]
          },
          insufficient: { type: "boolean" },
          points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                evidence: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      page: {
                        type: "integer",
                      },
                      quote: {
                        type: "string"
                      }
                    },
                    required: ["page", "quote"]
                  }
                }
              },
              required: ["text", "evidence"]
            }
          }
        },
        required: ["kind", "insufficient", "points"]
      }
    }
  },
  required: ["insufficient", "sections"]
} as const;

export function geminiProvider(
  config: {
    key: string;
    model: string;
    timeoutMs: number;
  },
  transport: typeof fetch = fetch
): StudyProvider {
  async function request<T>(instructions:string,payload:unknown,schema:unknown,validate:(raw:unknown)=>T):Promise<T> {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), config.timeoutMs);

      let stage: "request" | "read-response" | "parse-response" | "validate-response" = "request";
      try {
        if (!/^gemini-[a-z0-9.-]{1,100}$/.test(config.model)) {
          throw new StudyProviderError("configuration", "configuration");
        }

        const response = await transport(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
          {
            method: "POST",
            signal: abort.signal,
            cache: "no-store",
            redirect: "error",

            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": config.key
            },

            body: JSON.stringify({
              systemInstruction: {
                parts: [
                  {
                    text: instructions
                  }
                ]
              },

              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: JSON.stringify(payload)
                    }
                  ]
                }
              ],

              generationConfig: {
                temperature: 0.2,
                candidateCount: 1,
                maxOutputTokens: 6000,
                responseMimeType: "application/json",
                responseJsonSchema: schema
              }
            })
          }
        );

        if (response.status === 429) {
          throw new StudyProviderError("provider_quota", "http", response.status);
        }

        if (!response.ok) {
          throw new StudyProviderError([400, 401, 403, 404].includes(response.status) ? "configuration" : "failed", "http", response.status);
        }
        stage = "read-response";

        const reader = response.body?.getReader();

        if (!reader) {
          throw new StudyProviderError("failed", stage);
        }

        const chunks: Uint8Array[] = [];
        let size = 0;

        try {
          while (true) {
            const next = await reader.read();

            if (next.done) break;

            size += next.value.byteLength;

            if (size > 200000) {
              await reader.cancel();
              throw new StudyProviderError("failed", stage);
            }

            chunks.push(next.value);
          }
        } finally {
          reader.releaseLock();
        }

        const bytes = new Uint8Array(size);

        let offset = 0;

        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }

        stage = "parse-response";
        const raw = JSON.parse(
          new TextDecoder().decode(bytes)
        ) as {
          candidates?: Array<{
            finishReason?: string;
            content?: {
              parts?: Array<{
                text?: string;
                thought?: boolean;
              }>;
            };
          }>;
        };

        const candidate = raw.candidates?.[0];

        if (
          !candidate ||
          candidate.finishReason !== "STOP" ||
          !candidate.content?.parts
        ) {
          throw new StudyProviderError("failed", stage);
        }

        const text = candidate.content.parts
          .filter((part) => !part.thought)
          .map((part) => part.text ?? "")
          .join("");

        if (!text) {
          throw new StudyProviderError("failed", stage);
        }

        stage = "validate-response";
        return validate(JSON.parse(text));
      } catch (error) {
        if (abort.signal.aborted) throw new StudyProviderError("timeout", stage);
        throw error instanceof StudyProviderError ? error : new StudyProviderError("failed", stage);
      } finally {
        clearTimeout(timer);
      }
  }
  return {
    generate: (input,pages)=>request(studyInstructions(input.mode,input.locale),{pages},responseJsonSchema,raw=>validateStudyResponse(raw,pages,input.mode)),
    reviewStudyAnswers: (locale,pages,answers)=>request(answerReviewInstructions(locale),{pages,answers},answerReviewJsonSchema,raw=>validateAnswerReview(raw,pages,answers))
  };
}
