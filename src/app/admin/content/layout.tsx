import {requireAdmin} from "@/lib/auth";
import {AdminNavigation} from "@/components/admin-navigation";
export default async function ContentLayout({children}:{children:React.ReactNode}){await requireAdmin();return <><AdminNavigation kind="content"/>{children}</>;}
