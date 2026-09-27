"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useI18n } from "./locale-provider";
import { SectionLink } from "./ui";
import { SubjectMotif } from "./subject-motif";
import { subjectName } from "@/lib/i18n";
import { loadRecentSmsWorks } from "@/app/actions/sms";
import type { SubjectRow } from "@/lib/database.types";
import type { SmsAssessment } from "@/lib/sms/types";

interface RecentSmsGradesProps {
  subjects: SubjectRow[];
  sessionPresent: boolean;
}

interface FormattedWorkItem {
  id: string;
  subjectName: string;
  rawSubject: string;
  matchedSubject?: SubjectRow;
  title: string;
  type?: "formative" | "sor" | "soch" | "other";
  score?: number;
  max?: number;
  percent?: number;
  date?: string;
  formattedDate?: string;
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().trim();
}

function findMatchingSubject(name: string, subjects: SubjectRow[]): SubjectRow | undefined {
  const norm = normalize(name);
  const matches = subjects.filter((s) =>
    [s.name, s.name_ru, s.name_kz, s.name_en, s.short_name].some((v) => v && normalize(v) === norm)
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function RecentSmsGrades({ subjects, sessionPresent }: RecentSmsGradesProps) {
  const { locale } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [connected, setConnected] = useState(sessionPresent);
  const [works, setWorks] = useState<FormattedWorkItem[]>([]);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);

  const localeTag = locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-KZ" : "en-GB";

  function formatWorks(rawList: SmsAssessment[]): FormattedWorkItem[] {
    return rawList
      .filter((a) => (a.type === "sor" || a.type === "soch") && a.score !== undefined)
      .slice(0, 4)
      .map((a, idx) => {
        const matched = findMatchingSubject(a.subject, subjects);
        const typeLabel =
          a.type === "sor"
            ? (locale === "kk" ? "БЖБ" : locale === "en" ? "SOR" : "СОР")
            : (locale === "kk" ? "ТЖБ" : locale === "en" ? "SOCH" : "СОЧ");

        return {
          id: `work-${a.subject}-${a.date ?? ""}-${idx}-${a.title ?? ""}`,
          subjectName: matched ? subjectName(matched, locale) : a.subject,
          rawSubject: a.subject,
          matchedSubject: matched,
          title: a.title || typeLabel,
          type: a.type,
          score: a.score,
          max: a.max,
          percent:
            a.percent ??
            (a.score !== undefined && a.max !== undefined && a.max > 0
              ? Math.round((a.score / a.max) * 100)
              : undefined),
          date: a.date,
          formattedDate: a.date
            ? new Intl.DateTimeFormat(localeTag, { month: "short", day: "numeric", timeZone: "UTC" }).format(
                new Date(a.date + "T12:00:00Z")
              )
            : undefined,
        };
      });
  }

  useEffect(() => {
    // 1. Check cached recent works
    try {
      const cachedRaw = localStorage.getItem("sms_diary_recent_works");
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWorks(formatWorks(parsed));
          setHasLoadedCache(true);
        }
      } else {
        // Fallback check details cache if available
        const detRaw = localStorage.getItem("sms_diary_details");
        if (detRaw) {
          const det = JSON.parse(detRaw);
          const allAssessments: SmsAssessment[] = [];
          for (const item of Object.values(det) as { assessments?: SmsAssessment[] }[]) {
            if (item?.assessments) allAssessments.push(...item.assessments);
          }
          if (allAssessments.length > 0) {
            allAssessments.sort((a, b) => (b.date || "0000").localeCompare(a.date || "0000"));
            setWorks(formatWorks(allAssessments));
            setHasLoadedCache(true);
          }
        }
      }
    } catch {
      // Ignore parse errors
    }

    // 2. Fetch fresh works in background if session is present
    if (sessionPresent) {
      startTransition(async () => {
        try {
          const res = await loadRecentSmsWorks();
          if (res.works) {
            setConnected(true);
            try {
              localStorage.setItem("sms_diary_recent_works", JSON.stringify(res.works));
            } catch {}
            setWorks(formatWorks(res.works));
            setHasLoadedCache(true);
          } else if (res.error === "session_expired") {
            setConnected(false);
          }
        } catch {
          // Keep cached data
        }
      });
    }
  }, [sessionPresent]);

  const copy = {
    ru: {
      title: "СОР и СОЧ из SMS",
      source: "СОР · СОЧ",
      connectLead: "Подключите SMS-дневник, чтобы видеть последние СОР и СОЧ прямо на главном экране.",
      connectBtn: "Подключить дневник",
      openDiary: "Все работы в дневнике",
      noWorks: "В текущей четверти пока нет выставленных СОР / СОЧ.",
      loading: "Загрузка работ из SMS…",
      types: {
        sor: "СОР",
        soch: "СОЧ",
      },
    },
    kk: {
      title: "SMS-тен БЖБ және ТЖБ",
      source: "БЖБ · ТЖБ",
      connectLead: "Басты экранда соңғы БЖБ мен ТЖБ көру үшін SMS-күнделікті байланыстырыңыз.",
      connectBtn: "Күнделікті қосу",
      openDiary: "Күнделіктегі барлық жұмыстар",
      noWorks: "Ағымдағы тоқсанда әзірге БЖБ / ТЖБ жоқ.",
      loading: "SMS жұмыстары жүктелуде…",
      types: {
        sor: "БЖБ",
        soch: "ТЖБ",
      },
    },
    en: {
      title: "SOR & SOCH from SMS",
      source: "SOR · SOCH",
      connectLead: "Connect SMS Diary to track latest SOR and SOCH scores on the dashboard.",
      connectBtn: "Connect Diary",
      openDiary: "All works in diary",
      noWorks: "No graded SOR / SOCH in the current term yet.",
      loading: "Loading works from SMS…",
      types: {
        sor: "SOR",
        soch: "SOCH",
      },
    },
  }[locale];

  if (!connected) {
    return (
      <section className="surface-card recent-sms-card">
        <div className="recent-sms-header">
          <div>
            <h2 className="section-title">{copy.title}</h2>
          </div>
          <span className="recent-sms-badge" data-connected="false">
            {copy.source}
          </span>
        </div>
        <div className="recent-sms-empty">
          <p>{copy.connectLead}</p>
          <div className="recent-sms-empty-action">
            <Link href="/diary" className="button button-secondary text-sm">
              {copy.connectBtn}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="surface-card recent-sms-card">
      <div className="recent-sms-header">
        <div>
          <h2 className="section-title">{copy.title}</h2>
        </div>
        <span className="recent-sms-badge" data-connected="true">
          <span className="sms-status-dot" style={{ width: 6, height: 6 }} />
          {copy.source}
        </span>
      </div>

      {isPending && !hasLoadedCache ? (
        <div className="recent-sms-empty">
          <p className="text-sm text-[var(--muted)]">{copy.loading}</p>
        </div>
      ) : works.length === 0 ? (
        <div className="recent-sms-empty">
          <p className="text-sm text-[var(--muted)]">{copy.noWorks}</p>
          <div className="recent-sms-empty-action">
            <Link href="/diary" className="text-link text-sm">
              {copy.openDiary} →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="recent-sms-list">
            {works.map((work) => {
              const gradeLevel =
                work.percent !== undefined
                  ? work.percent >= 80
                    ? "high"
                    : work.percent >= 60
                    ? "mid"
                    : "low"
                  : "high";

              return (
                <div key={work.id} className="recent-sms-item">
                  <div className="recent-sms-info">
                    <div className="recent-sms-motif">
                      <SubjectMotif subject={work.matchedSubject} />
                    </div>
                    <div className="recent-sms-titles">
                      <div className="recent-sms-subject" title={work.rawSubject}>
                        {work.subjectName}
                      </div>
                      <div className="recent-sms-submeta">
                        {work.type && (
                          <span className="recent-sms-type-chip" data-type={work.type}>
                            {copy.types[work.type as "sor" | "soch"] || work.type}
                          </span>
                        )}
                        <span title={work.title}>{work.title}</span>
                        {work.formattedDate && <span>· {work.formattedDate}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="recent-sms-score-col">
                    {work.score !== undefined ? (
                      <>
                        <span className="recent-sms-score-main">
                          {work.score}
                          {work.max !== undefined && (
                            <small className="text-xs text-[var(--muted)] font-normal">/{work.max}</small>
                          )}
                        </span>
                        {work.percent !== undefined && (
                          <span className="recent-sms-score-pill" data-grade={gradeLevel}>
                            {Math.round(work.percent)}%
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <SectionLink href="/diary">{copy.openDiary}</SectionLink>
        </>
      )}
    </section>
  );
}
