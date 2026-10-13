import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { database } from "@/lib/queries";
import { needsSchoolOnboarding } from "@/lib/schools";
import { sortClasses } from "@/lib/catalog";
import { PublicHeader } from "@/components/public-header";
import { SchoolOnboarding } from "@/components/school-onboarding";

export const metadata: Metadata = { title: "Ваша школа", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const { user, profile } = await requireViewer("/onboarding");
  if (!needsSchoolOnboarding(profile)) redirect("/profile");
  const db = await database();
  // This authenticated route avoids the ordinary catalogue's onboarding gate.
  const [classes, subjects, top] = await Promise.all([
    db.from("classes").select("*").order("name"), db.from("subjects").select("*").order("name"),
    db.from("profile_top_subjects").select("subject_id,position").eq("profile_id", user.id).order("position"),
  ]);
  if (classes.error || subjects.error || top.error) throw new Error("Не удалось загрузить данные профиля.");
  return <div className="public-experience onboarding-experience"><PublicHeader compact />
    <SchoolOnboarding profile={profile} classes={sortClasses(classes.data)} subjects={subjects.data}
      top={[1, 2, 3, 4].map(position => top.data.find(row => row.position === position)?.subject_id ?? "")} />
  </div>;
}
