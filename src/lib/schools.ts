import catalog from "./data/nis-schools.json";
import type { Locale } from "./i18n";

export const nisCities = catalog.cities;
export const nisSchools = catalog.schools;
export const schoolCatalogSource = catalog.source;
export type NisCity = (typeof nisCities)[number];
export type NisSchool = (typeof nisSchools)[number];

export function schoolLabel(value: Pick<NisCity, "name_ru" | "name_kk" | "name_en">, locale: Locale) {
  return value[locale === "kk" ? "name_kk" : locale === "en" ? "name_en" : "name_ru"];
}
export function schoolById(id?: string | null) { return nisSchools.find(school => school.id === id); }
export function cityById(id?: string | null) { return nisCities.find(city => city.id === id); }
export function schoolsInCity(id: string) { return nisSchools.filter(school => school.city_id === id); }
export function validSchoolSelection(city: string, school: string) {
  return nisSchools.some(row => row.id === school && row.city_id === city);
}
export function needsSchoolOnboarding(profile: {
  role: "student" | "admin"; school_id?: string | null; onboarding_completed_at?: string | null;
} | null) {
  return !!profile && profile.role !== "admin" && (!profile.school_id || !profile.onboarding_completed_at);
}
