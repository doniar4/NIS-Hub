import {database} from "@/lib/queries";
import {getI18n} from "@/lib/i18n-server";
import {SiteShell} from "./site-shell";
import {AdminDashboard} from "./admin-dashboard";
export async function AdminOverview(){
 const {locale}=await getI18n(),db=await database();
 const [recent,open,unread]=await Promise.all([
 db.from("schedule_import_batches").select("id,created_at,source_type,row_count").order("created_at",{ascending:false}).limit(5),
 db.from("support_tickets").select("id",{count:"exact",head:true}).in("status",["open","in_progress"]),
 db.from("support_tickets").select("id",{count:"exact",head:true}).in("status",["open","in_progress"]).eq("needs_admin_reply",true)]);
 if(recent.error||open.error||unread.error)throw new Error("Admin summary unavailable");
 return <SiteShell><AdminDashboard locale={locale} open={open.count??0} unread={unread.count??0} recent={recent.data}/></SiteShell>;
}
