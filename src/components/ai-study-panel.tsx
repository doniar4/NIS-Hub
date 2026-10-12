"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  MagicWandIcon,
  ChevronDownIcon,
  ReaderIcon,
  ReloadIcon,
  BookmarkIcon,
  FileTextIcon,
  QuestionMarkCircledIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
} from "@radix-ui/react-icons";
import { useI18n } from "./locale-provider";
import { v051Copy } from "@/lib/v051-copy";
import { aiStudyPanelCopy } from "@/lib/ai-study-panel-copy";
import { generateStudy } from "@/app/actions/ai-study";
import { STUDY_MODES, type StudyInput, type StudyResult } from "@/lib/ai-study";
import { AiGenerateButton } from "./ai-generate-button";
import { StudyAnswerForm } from "./study-answer-form";
import { MAX_STUDY_PAGE, studyRangeEnd } from "@/lib/study-range";
import { communityCopy } from "@/lib/community-copy";

const labels = {
  ru: {
    overview: "Обзор",
    concepts: "Ключевые понятия",
    definitions: "Определения",
    facts: "Формулы и факты",
    confusions: "Что можно перепутать",
    mistakes: "Ошибки по материалу",
    questions: "Самопроверка",
    checklist: "Чек-лист",
  },
  kk: {
    overview: "Шолу",
    concepts: "Негізгі ұғымдар",
    definitions: "Анықтамалар",
    facts: "Формулалар мен деректер",
    confusions: "Шатастыруға болатын тұстар",
    mistakes: "Материал бойынша қателер",
    questions: "Өзін-өзі тексеру",
    checklist: "Тексеру тізімі",
  },
  en: {
    overview: "Overview",
    concepts: "Key concepts",
    definitions: "Definitions",
    facts: "Formulas and facts",
    confusions: "Potential confusions",
    mistakes: "Source-based mistakes",
    questions: "Self-check",
    checklist: "Checklist",
  },
};
const modeIcons = {
  summary: ReaderIcon,
  review: ReloadIcon,
  sor: BookmarkIcon,
  soch: FileTextIcon,
  questions: QuestionMarkCircledIcon,
};
export type AiPanelConfig = {
  enabled: boolean;
  maxPages: number;
  maxChars: number;
  dailyLimit: number;
  sourceReady?: boolean;
};
type Outcome = {
  result: StudyResult;
  locale: StudyInput["locale"];
  mode: StudyInput["mode"];
};
export function AiStudyPanel({
  variantId,
  totalPages,
  initialPage,
  config,
  defaultOpen = false,
  embedded = false,
}: {
  variantId: string;
  totalPages: number | null;
  initialPage: number;
  config: AiPanelConfig;
  defaultOpen?: boolean;
  embedded?: boolean;
}) {
  const { locale, t } = useI18n(),
    p = v051Copy(locale),
    c = aiStudyPanelCopy(locale),
    id = useId();
  const lastPage = Math.min(totalPages ?? MAX_STUDY_PAGE, MAX_STUDY_PAGE);
  const initial = Math.max(1, Math.min(initialPage, lastPage));
  const [start, setStart] = useState(String(initial)),
    [end, setEnd] = useState(String(initial)),
    [readerPage, setReaderPage] = useState(initial),
    [mode, setMode] = useState<StudyInput["mode"]>("summary");
  const [outcome, setOutcome] = useState<Outcome | null>(null),
    [pending, transition] = useTransition(),
    [slow, setSlow] = useState(false);
  const edited = useRef(false),
    working = useRef(false),
    currentLocale = useRef<typeof locale | null>(locale);
  const result =
    outcome?.locale === locale && outcome.mode === mode ? outcome.result : null;
  const first = Number(start),
    last = Number(end),
    count = last - first + 1;
  const validRange =
    Number.isInteger(first) &&
    Number.isInteger(last) &&
    first >= 1 &&
    last <= lastPage &&
    count >= 1 &&
    count <= config.maxPages;
  const errorText =
    result?.error === "configuration"
      ? p.aiConfiguration
      : result?.error === "timeout"
        ? p.aiTimeout
        : result?.error === "busy"
          ? p.aiBusy
          : result?.error === "provider_unavailable"
            ? p.aiProviderUnavailable
            : result?.error === "provider_quota"
              ? p.aiProviderQuota
              : result?.error === "quota"
                ? p.quota
                : result?.error === "unavailable"
                  ? p.unavailable
                  : result?.error === "disabled"
                    ? p.aiDisabled
                    : p.aiError;
  const retryable =
    result?.error &&
    ["timeout", "provider_unavailable", "failed", "busy"].includes(
      result.error,
    );
  useEffect(() => {
    currentLocale.current = locale;
    return () => {
      currentLocale.current = null;
    };
  }, [locale]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), 20000);
    return () => clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    const follow = (event: Event) => {
      const detail = (event as CustomEvent<{ variantId: string; page: number }>)
        .detail;
      if (detail?.variantId !== variantId || !Number.isInteger(detail.page))
        return;
      const page = Math.max(1, Math.min(detail.page, lastPage));
      setReaderPage(page);
      if (edited.current || working.current) return;
      setStart(String(page));
      setEnd(String(page));
    };
    window.addEventListener("nis-reader-page", follow);
    return () => window.removeEventListener("nis-reader-page", follow);
  }, [variantId, lastPage]);
  function submitRange(from = first, to = last) {
    if (
      working.current ||
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 1 ||
      to > lastPage ||
      to < from ||
      to - from >= config.maxPages
    )
      return;
    setOutcome(null);
    setSlow(false);
    edited.current = true;
    working.current = true;
    transition(async () => {
      try {
        const next = await generateStudy({
          variantId,
          start: from,
          end: to,
          mode,
          locale,
        });
        if (currentLocale.current === locale)
          setOutcome({ result: next, locale, mode });
      } catch {
        if (currentLocale.current === locale)
          setOutcome({ result: { error: "failed" }, locale, mode });
      } finally {
        working.current = false;
      }
    });
  }
  return (
    <aside className="ai-study-panel">
      <details
        className={embedded ? undefined : "surface-card"}
        open={defaultOpen}
      >
        <summary className="ai-study-summary">
          <MagicWandIcon aria-hidden="true" />
          <span>
            <strong>{p.ai}</strong>
            <small>{communityCopy(locale).aiHelp}</small>
          </span>
          <ChevronDownIcon className="ai-study-chevron" aria-hidden="true" />
        </summary>
        {!config.enabled ? (
          <div className="study-message" role="status">
            {p.aiDisabled}
          </div>
        ) : config.sourceReady === false ? (
          <div className="study-message" role="status">
            {p.unavailable}
          </div>
        ) : (
          <div className="ai-study-content">
            <header className="study-intro">
              <span className="study-intro-mark">
                <ReaderIcon aria-hidden="true" />
              </span>
              <div>
                <h3>{c.title}</h3>
                <p>{c.subtitle}</p>
              </div>
            </header>
            <form
              className="study-request"
              onSubmit={(event) => {
                event.preventDefault();
                submitRange();
              }}
            >
              <fieldset disabled={pending}>
                <div className="study-field-heading">
                  <span>{c.range}</span>
                  <button
                    className="study-text-button"
                    type="button"
                    onClick={() => {
                      edited.current = false;
                      setStart(String(readerPage));
                      setEnd(String(readerPage));
                      setOutcome(null);
                    }}
                  >
                    {c.current}
                    <ArrowRightIcon aria-hidden="true" />
                  </button>
                </div>
                <div className="ai-study-range">
                  <label>
                    <span className="field-label">{p.from}</span>
                    <input
                      className="field"
                      type="number"
                      step={1}
                      min={1}
                      max={lastPage}
                      required
                      value={start}
                      aria-describedby={id + "-range-hint"}
                      onChange={(e) => {
                        edited.current = true;
                        setStart(e.target.value);
                        const next = Number(e.target.value);
                        if (
                          Number.isInteger(next) &&
                          next >= 1 &&
                          next <= lastPage
                        )
                          setEnd(
                            String(
                              studyRangeEnd(
                                next,
                                Number(end) || next,
                                config.maxPages,
                                totalPages,
                              ),
                            ),
                          );
                        setOutcome(null);
                      }}
                    />
                  </label>
                  <span className="study-range-arrow" aria-hidden="true">
                    →
                  </span>
                  <label>
                    <span className="field-label">{p.to}</span>
                    <input
                      className="field"
                      type="number"
                      step={1}
                      min={first || 1}
                      max={Math.min(
                        lastPage,
                        (first || 1) + config.maxPages - 1,
                      )}
                      required
                      value={end}
                      aria-describedby={id + "-range-hint"}
                      onChange={(e) => {
                        edited.current = true;
                        setEnd(e.target.value);
                        setOutcome(null);
                      }}
                    />
                  </label>
                </div>
                <p id={id + "-range-hint"} className="study-range-hint">
                  {validRange ? c.rangeHint : c.invalidRange}
                </p>
                <fieldset className="study-modes">
                  <legend>{c.task}</legend>
                  <div className="study-mode-grid">
                    {STUDY_MODES.map((value) => {
                      const Icon = modeIcons[value];
                      return (
                        <label
                          key={value}
                          className="study-mode"
                          data-selected={mode === value}
                        >
                          <input
                            type="radio"
                            name={id + "-mode"}
                            value={value}
                            checked={mode === value}
                            onChange={() => {
                              setMode(value);
                              setOutcome(null);
                            }}
                          />
                          <Icon
                            className="study-mode-icon"
                            aria-hidden="true"
                          />
                          <span>
                            <strong>{p.modes[value]}</strong>
                            <small>{c.descriptions[value]}</small>
                          </span>
                          <CheckIcon
                            className="study-mode-check"
                            aria-hidden="true"
                          />
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <AiGenerateButton
                  pending={pending}
                  disabled={!validRange}
                  label={pending ? p.working : retryable ? c.retry : p.generate}
                />
              </fieldset>
            </form>
            {pending && (
              <div className="study-loading" role="status">
                <div className="study-loading-heading">
                  <MagicWandIcon aria-hidden="true" />
                  <strong>{slow ? c.slow : c.loading}</strong>
                </div>
                <p>{slow ? c.slowHint : c.loadingHint}</p>
                <div className="study-skeleton" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            {result?.error && (
              <div className="study-error" role="alert">
                <div className="study-loading-heading">
                  <ExclamationTriangleIcon aria-hidden="true" />
                  <strong>{c.errorTitle}</strong>
                </div>
                <p>{errorText}</p>
                {result.error === "timeout" && validRange && count > 1 && (
                  <button
                    className="study-retry-button"
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setEnd(start);
                      submitRange(first, first);
                    }}
                  >
                    <ReaderIcon aria-hidden="true" />
                    {c.onePage}
                    <ArrowRightIcon aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {!pending && !result && (
              <div className="study-empty">
                <span className="study-empty-mark">
                  <FileTextIcon aria-hidden="true" />
                </span>
                <strong>{c.emptyTitle}</strong>
                <p>{c.emptyHint}</p>
              </div>
            )}
            {result?.response && result.source && (
              <section className="study-result" aria-label={p.ai}>
                <header className="study-result-heading">
                  <span className="study-result-check">
                    <CheckIcon aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{c.ready}</h3>
                    <p>
                      {p.source}: {t.pages} {result.source.start}–
                      {result.source.end}
                      {result.cached && <span> · {p.cached}</span>}
                    </p>
                  </div>
                </header>
                {result.response.insufficient && (
                  <p className="study-message">{p.insufficient}</p>
                )}
                {result.response.sections.map((section) => (
                  <section className="study-result-section" key={section.kind}>
                    <h4>{labels[locale][section.kind]}</h4>
                    {section.insufficient && (
                      <p className="study-section-note">{p.insufficient}</p>
                    )}
                    <ul>
                      {section.points.map((point, index) => (
                        <li key={index}>
                          <p className="study-point">{point.text}</p>
                          {point.evidence.map((citation, n) => (
                            <blockquote key={n}>
                              <p>“{citation.quote}”</p>
                              <cite>
                                {t.page} {citation.page}
                              </cite>
                            </blockquote>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </section>
            )}
            {mode === "questions" &&
              result?.response &&
              result.generationId && (
                <StudyAnswerForm
                  key={result.generationId + locale}
                  generationId={result.generationId}
                  response={result.response}
                />
              )}
            <details className="study-privacy">
              <summary>
                {c.privacy}
                <ChevronDownIcon aria-hidden="true" />
              </summary>
              <p>{p.aiConsent}</p>
              <p>
                {c.upTo} {config.maxPages} {t.pages} ·{" "}
                {config.maxChars.toLocaleString(locale)} {c.characters} ·{" "}
                {config.dailyLimit} {c.daily}
              </p>
            </details>
          </div>
        )}
      </details>
    </aside>
  );
}
