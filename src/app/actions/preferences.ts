"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { locales, LOCALE_COOKIE } from "@/lib/i18n";
export async function changeLocale(value: string) {
  if (!locales.some(locale => locale === value)) return { ok: false };
  (await cookies()).set(LOCALE_COOKIE, value, { path: "/", maxAge: 31536000, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  revalidatePath("/", "layout");
  return { ok: true };
}
