import type { Metadata } from "next";
import { absoluteSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Terms",
  alternates: { canonical: absoluteSiteUrl("/terms") },
  robots: { index: true, follow: true },
};
import { LegalDocument } from "@/components/legal-document";
export default function TermsPage() { return <LegalDocument kind="terms"/>; }
