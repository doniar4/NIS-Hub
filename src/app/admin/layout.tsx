import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { controlCopy } from "@/lib/admin-control";
import { SiteShell } from "@/components/site-shell";
import { AdminNavigation } from "@/components/admin-navigation";
export const metadata:Metadata={title:"Admin",robots:{index:false,follow:false}};
export default async function AdminLayout({children}:{children:React.ReactNode}) {
  await requireAdmin();
  const {locale}=await getI18n(), t=controlCopy(locale);
  return <SiteShell><section className="admin-center"><header className="admin-header"><p className="eyebrow">NIS Hub · Admin</p><h1>{t.control}</h1><p>{t.hint}</p></header><AdminNavigation/><div className="admin-section">{children}</div></section></SiteShell>;
}
