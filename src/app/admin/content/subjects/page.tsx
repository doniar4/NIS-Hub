import {requireAdmin} from "@/lib/auth";
import {AdminRecordsWorkspace,type RecordParams} from "@/components/admin-records-workspace";
export default async function SubjectsPage({searchParams}:{searchParams:Promise<RecordParams>}){await requireAdmin();return <AdminRecordsWorkspace entity="subjects" params={await searchParams}/>;}
