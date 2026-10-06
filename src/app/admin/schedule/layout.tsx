import {requireAdmin} from "@/lib/auth";
import {AdminNavigation} from "@/components/admin-navigation";
export default async function ScheduleLayout({children}:{children:React.ReactNode}){await requireAdmin();return <><AdminNavigation kind="schedule"/>{children}</>;}
