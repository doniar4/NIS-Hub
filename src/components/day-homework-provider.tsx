"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ClassHomework } from "@/lib/database.types";
import type { CommunityError } from "@/lib/people";
import { homeworkBySubject } from "@/lib/daily-homework";

type HomeworkDay = {
  date: string; rows: ClassHomework[]; loading: boolean; error: CommunityError | null;
  bySubject: Map<string, ClassHomework[]>;
};
const emptyRows: ClassHomework[] = [];
const DayContext = createContext<HomeworkDay | null>(null);

function useLoadDay(date: string, enabled: boolean, classId?: string): HomeworkDay {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    date: string; classId?: string; revision: number; rows: ClassHomework[]; error: CommunityError | null;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void import("@/app/actions/homework").then(({ loadDailyHomework }) => loadDailyHomework(date))
      .then(value => {
        if (active) setResult({ date, classId, revision,
          rows: "error" in value ? [] : value.data, error: "error" in value ? value.error : null });
      }).catch(() => {
        if (active) setResult({ date, classId, revision, rows: [], error: "failed" });
      });
    return () => { active = false; };
  }, [date, enabled, classId, revision]);
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("nis-homework-change", refresh);
    return () => window.removeEventListener("nis-homework-change", refresh);
  }, [enabled]);
  // Never flash a previous day/class or an older refresh response.
  const current = enabled && result?.date === date && result.classId === classId && result.revision === revision ? result : null;
  const rows = current?.rows ?? emptyRows;
  const bySubject = useMemo(() => homeworkBySubject(rows, date, classId), [rows, date, classId]);
  return { date, rows, bySubject, loading: enabled && !current, error: current?.error ?? null };
}

export function DayHomeworkProvider({ date, classId, children }: { date: string; classId: string; children: ReactNode }) {
  const day = useLoadDay(date, !!classId, classId);
  return <DayContext value={day}>{children}</DayContext>;
}

export function useProvidedHomeworkDay() { return useContext(DayContext); }

// Standalone previews/editors retain a local, page-scoped loader. Within a daily
// schedule they share its one request, including when the editor is collapsed.
export function useHomeworkDay(date: string, enabled: boolean) {
  const shared = useProvidedHomeworkDay();
  const matches = shared?.date === date;
  const local = useLoadDay(date, enabled && !matches);
  return matches ? shared : local;
}
