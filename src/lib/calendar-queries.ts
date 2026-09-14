import "server-only";
import { requireViewer } from "./auth";
import { database } from "./queries";
import type { NonSchoolDay } from "./database.types";
export async function getNonSchoolDays() {
  await requireViewer("/schedule");
  const db = await database(), rows: NonSchoolDay[] = [];
  for (let page=0;page<=10;page++) {
    let query = db.from("non_school_days").select("*").order("id").limit(500);
    if (rows.length) query=query.gt("id",rows.at(-1)!.id);
    const {data,error}=await query;
    if(error || (page===10 && data?.length)) throw new Error("School calendar unavailable");
    rows.push(...data);
    if(data.length<500) return rows;
  }
  return rows;
}
