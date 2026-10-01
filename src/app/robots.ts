import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms"],
      disallow: [
        "/admin", "/api", "/auth", "/books", "/diary", "/forbidden",
        "/friends", "/library", "/liquid-glass", "/login", "/messages",
        "/people", "/profile", "/schedule", "/setup", "/signup", "/support",
      ],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
  };
}
