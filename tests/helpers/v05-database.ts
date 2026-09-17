import {readFileSync} from "node:fs";
import {phase3Database} from "./database";
export async function v05Database() {
 const db=await phase3Database();
 try {
  for(const name of ["202609120002_phase4_books.sql","202609120003_phase4_weekly_schedule.sql","202609140001_v05_school_calendar.sql","202609140002_v05_schedule_versions.sql","202609140003_v05_support.sql","202609140004_v05_private_covers.sql"])
   await db.exec(readFileSync(new URL("../../supabase/migrations/"+name,import.meta.url),"utf8"));
  return db;
 } catch(error){await db.close();throw error;}
}
