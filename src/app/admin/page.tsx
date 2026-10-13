import {redirect,notFound} from "next/navigation";
import {requireAdmin} from "@/lib/auth";
import {uuid} from "@/lib/validation";
import {AdminOverview} from "@/components/admin-overview";
export default async function AdminPage({searchParams}:{searchParams:Promise<{entity?:string;id?:string}>}){
 await requireAdmin();const p=await searchParams;
 if(p.entity){const destinations:Record<string,string>={books:"/admin/content",subjects:"/admin/content/subjects",schedule:"/admin/schedule",classes:"/admin/schedule/classes"};const to=destinations[p.entity];if(!to||p.id&&!uuid.safeParse(p.id).success)notFound();redirect(to+(p.id?"?id="+p.id:""));}
 return <AdminOverview/>;
}
