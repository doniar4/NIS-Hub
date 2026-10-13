import {redirect} from "next/navigation";
import {requireAdmin} from "@/lib/auth";
import {uuid} from "@/lib/validation";
import {adminPage} from "@/lib/admin-control";
export default async function LegacyVersions({searchParams}:{searchParams:Promise<{id?:string;page?:string}>}){await requireAdmin();const p=await searchParams,q=new URLSearchParams();if(uuid.safeParse(p.id).success)q.set("id",p.id!);q.set("page",String(adminPage(p.page)));redirect("/admin/schedule/versions?"+q);}
