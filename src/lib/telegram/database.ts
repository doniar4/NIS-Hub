import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import type { TelegramConfig } from "./security";
import { sessionSchema, type HomeworkStore, type HomeworkSubject } from "./types";

const classesSchema = z.array(z.object({ id: z.uuid(), name: z.string(), grade: z.number().int().min(7).max(12), section: z.string().nullable() }));
const subjectSchema = z.object({ id: z.uuid(), name: z.string(), name_ru: z.string().nullable() });

export function homeworkStore(config: TelegramConfig): HomeworkStore {
  const deadline = AbortSignal.timeout(45000);
  const db = createClient<Database>(config.supabaseUrl, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.any([deadline, AbortSignal.timeout(10000)]) }) },
  });
  return {
    async apply(input, action) {
      const { data, error } = await db.rpc("telegram_homework_apply_update", {
        p_update_id: input.updateId, p_user_id: input.userId, p_action: action.action, p_value: action.value,
        p_token: action.token, p_author: config.authorId,
      });
      if (error || !data) throw new Error("database_unavailable");
      return data;
    },
    async session(userId) {
      const { data, error } = await db.from("telegram_homework_sessions").select("telegram_user_id,step,grade,class_id,subject_id,due_date,body,token,last_update_id,updated_at,expires_at")
        .eq("telegram_user_id", userId).maybeSingle();
      if (error) throw new Error("database_unavailable");
      return data ? sessionSchema.parse(data) : null;
    },
    async classes(grade) {
      const { data, error } = await db.from("classes").select("id,name,grade,section").eq("grade", grade)
        .order("grade").order("section").order("name").limit(201);
      if (error || !data || data.length > 200) throw new Error("database_unavailable");
      return classesSchema.parse(data);
    },
    async subjects(classId) {
      const distinct = new Map<string, HomeworkSubject>();
      // Paginate schedule rows before deduplication; never silently truncate subjects.
      for (let offset = 0; offset < 10000; offset += 200) {
        const { data, error } = await db.from("weekly_schedule").select("id,subject:subjects!inner(id,name,name_ru)")
          .eq("class_id", classId).order("id").range(offset, offset + 199);
        if (error || !data) throw new Error("database_unavailable");
        const rows = z.array(z.object({ subject: subjectSchema })).parse(data as unknown);
        for (const row of rows) distinct.set(row.subject.id, row.subject);
        if (rows.length < 200) return [...distinct.values()].sort((a, b) => (a.name_ru?.trim() || a.name).localeCompare(b.name_ru?.trim() || b.name, "ru"));
      }
      throw new Error("schedule_limit");
    },
  };
}
