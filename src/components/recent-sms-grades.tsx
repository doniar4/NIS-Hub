"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useI18n } from "./locale-provider";
import { SectionLink } from "./ui";
import { SubjectMotif } from "./subject-motif";
import { subjectName } from "@/lib/i18n";
import { loadRecentSmsWorks } from "@/app/actions/sms";
import type { SubjectRow } from "@/lib/database.types";
import type { SmsAssessment } from "@/lib/sms/types";
import {RECENT_SMS_CACHE_KEY,SMS_NOTICE_CACHE_KEY,parseSmsResultNotices,smsAssessmentChanges,smsAssessmentKey,snapshotAssessments,sortSmsAssessments} from "@/lib/sms/recent";

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
  change?: "new" | "updated";
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
  const cachedWorks = useRef<SmsAssessment[]>([]);

  const localeTag = locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-KZ" : "en-GB";

  const formatWorks=useCallback((rawList: SmsAssessment[], previous: SmsAssessment[] = []): FormattedWorkItem[] => {
    const changes=smsAssessmentChanges(rawList,previous);
    return sortSmsAssessments(rawList)
      .map((a, idx) => {
        const matched = findMatchingSubject(a.subject, subjects);
        const typeLabel =
          a.type === "sor"
            ? (locale === "kk" ? "БЖБ" : locale === "en" ? "SOR" : "СОР")
            : a.type === "soch"
              ? (locale === "kk" ? "ТЖБ" : locale === "en" ? "SOCH" : "СОЧ")
              : a.type === "formative"
                ? (locale === "kk" ? "ҚБ" : locale === "en" ? "Formative" : "ФО")
                : (locale === "kk" ? "Жұмыс" : locale === "en" ? "Assessment" : "Работа");

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
          change: previous.length === 0 ? undefined : changes.get(smsAssessmentKey(a)),
        };
      });
  },[locale,localeTag,subjects]);

  useEffect(() => {
    let alive=true,busy=false;
    let hydrateTimer:number|undefined;
    try {
      let cached:SmsAssessment[]=[];
      const cachedRaw=localStorage.getItem(RECENT_SMS_CACHE_KEY);
      if(cachedRaw) {
        const parsed=JSON.parse(cachedRaw);
        if(Array.isArray(parsed))cached=sortSmsAssessments(parsed);
      }
      if(!cached.length) {
        const snapshotRaw=localStorage.getItem("sms_diary_snapshot");
        if(snapshotRaw)cached=snapshotAssessments(JSON.parse(snapshotRaw));
      }
      if(!cached.length) {
        const detailsRaw=localStorage.getItem("sms_diary_details");
        if(detailsRaw)cached=sortSmsAssessments(Object.values(JSON.parse(detailsRaw) as Record<string,{assessments?:SmsAssessment[]}>).flatMap(item=>item.assessments??[]));
      }
      if(cached.length) {
        cachedWorks.current=cached;
        hydrateTimer=window.setTimeout(()=>{setWorks(formatWorks(cached));setHasLoadedCache(true);},0);
      }
    } catch {/* Invalid browser cache must not prevent a fresh SMS request. */}

    const refresh=async()=>{
      if(!sessionPresent||busy)return;
      busy=true;
        try {
          const res = await loadRecentSmsWorks();
          if(!alive)return;
          if (res.works) {
            if(hydrateTimer!==undefined)window.clearTimeout(hydrateTimer);
            const fresh=sortSmsAssessments(res.works),previous=cachedWorks.current;
            setConnected(true);
            try {
              localStorage.setItem(RECENT_SMS_CACHE_KEY,JSON.stringify(fresh));
            } catch {}
            setWorks(formatWorks(fresh,previous));
            if(previous.length) {
              const changes=smsAssessmentChanges(fresh,previous);
              const changed=fresh.filter(item=>changes.has(smsAssessmentKey(item)));
              if(changed.length) {
                const notice={
                id:`sms-${Date.now()}-${changed.map(smsAssessmentKey).join(";")}`,
                kind:"sms" as const,
                title:locale==="kk"?"SMS-те жаңа нәтижелер":locale==="en"?"New SMS results":"Новые результаты в SMS",
                body_preview:changed.slice(0,3).map(item=>`${item.subject}: ${item.score}${item.max!==undefined?`/${item.max}`:""}`).join(" · ")+(changed.length>3?` · +${changed.length-3}`:""),
                created_at:new Date().toISOString(),href:"/diary",read_at:null,
                };
                try {localStorage.setItem(SMS_NOTICE_CACHE_KEY,JSON.stringify([notice,...parseSmsResultNotices(localStorage.getItem(SMS_NOTICE_CACHE_KEY))].slice(0,20)));}catch{}
                window.dispatchEvent(new Event("nis-sms-results"));
              }
            }
            cachedWorks.current = fresh;
            setHasLoadedCache(true);
          } else if (res.error === "session_expired") {
            setConnected(false);
          }
        } catch {
          // Keep cached data
        } finally {busy=false;}
    };
    if(sessionPresent)startTransition(()=>{void refresh();});
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},5*60*1000);
    const onVisibility=()=>{if(!document.hidden)void refresh();};
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{alive=false;if(hydrateTimer!==undefined)window.clearTimeout(hydrateTimer);window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisibility);};
  }, [sessionPresent,formatWorks,locale]);

  const copy = {
    ru: {
      title: "Последние результаты из SMS",
      source: "Все работы",
      connectLead: "Подключите SMS-дневник, чтобы видеть все выставленные работы прямо на главном экране.",
      connectBtn: "Подключить дневник",
      openDiary: "Все работы в дневнике",
      noWorks: "В текущей четверти пока нет выставленных работ.",
      loading: "Загрузка работ из SMS…",
      newWork: "Новое",
      updatedWork: "Изменилось",
      types: {
        sor: "СОР",
        soch: "СОЧ",
        formative: "ФО",
        other: "Работа",
      },
    },
    kk: {
      title: "SMS-тегі соңғы нәтижелер",
      source: "Барлық жұмыстар",
      connectLead: "Барлық бағаланған жұмыстарды басты экранда көру үшін SMS-күнделікті байланыстырыңыз.",
      connectBtn: "Күнделікті қосу",
      openDiary: "Күнделіктегі барлық жұмыстар",
      noWorks: "Ағымдағы тоқсанда әзірге бағаланған жұмыстар жоқ.",
      loading: "SMS жұмыстары жүктелуде…",
      newWork: "Жаңа",
      updatedWork: "Өзгерді",
      types: {
        sor: "БЖБ",
        soch: "ТЖБ",
        formative: "ҚБ",
        other: "Жұмыс",
      },
    },
    en: {
      title: "Latest results from SMS",
      source: "All assessments",
      connectLead: "Connect SMS Diary to see every graded assessment on the dashboard.",
      connectBtn: "Connect Diary",
      openDiary: "All works in diary",
      noWorks: "No graded assessments in the current term yet.",
      loading: "Loading works from SMS…",
      newWork: "New",
      updatedWork: "Updated",
      types: {
        sor: "SOR",
        soch: "SOCH",
        formative: "Formative",
        other: "Assessment",
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
                            {copy.types[work.type] || work.type}
                          </span>
                        )}
                        <span title={work.title}>{work.title}</span>
                        {work.formattedDate && <span>· {work.formattedDate}</span>}
                        {work.change && <span className="recent-sms-change" data-change={work.change}>{work.change === "new" ? copy.newWork : copy.updatedWork}</span>}
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
