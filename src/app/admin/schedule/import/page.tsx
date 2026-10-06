import {requireAdmin} from "@/lib/auth";
import {AdminScheduleImport} from "@/components/admin-schedule-tools";
export default async function ImportPage(){await requireAdmin();return <AdminScheduleImport/>;}
