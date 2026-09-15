import {readFileSync,readdirSync} from "node:fs";
import {v05Database} from "./v05-database";
export async function v051Database(before?: (db: Awaited<ReturnType<typeof v05Database>>) => Promise<void>) {
 const db=await v05Database();
 try {
  if(before)await before(db);
  const dir=new URL("../../supabase/migrations/",import.meta.url);
  for(const name of readdirSync(dir).filter(n=>n.startsWith("20260915")&&n.endsWith(".sql")).sort())
   await db.exec(readFileSync(new URL(name,dir),"utf8"));
  return db;
 }catch(error){await db.close();throw error;}
}
