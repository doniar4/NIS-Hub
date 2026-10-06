import {redirect} from "next/navigation";
import {requireAdmin} from "@/lib/auth";
export default async function LegacyCalendar(){await requireAdmin();redirect("/admin/schedule/calendar");}
