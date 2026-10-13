import type { Metadata } from "next";
import { absoluteSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: absoluteSiteUrl("/privacy") },
  robots: { index: true, follow: true },
};
import { LegalDocument } from "@/components/legal-document";
export default function PrivacyPage() { return <LegalDocument kind="privacy"/>; }
