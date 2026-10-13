import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/site-url";

/** Public content only. Protected routes are intentionally excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/privacy", "/terms"].map((path) => ({
    url: absoluteSiteUrl(path),
    changeFrequency: "monthly" as const,
  }));
}
