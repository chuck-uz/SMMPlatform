import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/publicSite";

// Host comes from NEXTAUTH_URL at request time, not from source or build env.
export const dynamic = "force-dynamic";

// Public legal pages (privacy, data-deletion, terms) must stay crawlable so
// Meta's URL validators and link previewers can reach them; the panel and API
// are private and excluded. Meta's scraper checks robots.txt before fetching a
// URL and treats a missing/ambiguous file as a block, so facebookexternalhit
// and facebookcatalog are allowlisted by name in addition to the wildcard.
export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "facebookexternalhit",
        allow: "/",
      },
      {
        userAgent: "facebookcatalog",
        allow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/panel/", "/api/"],
      },
    ],
    ...(site ? { host: site.origin } : {}),
  };
}
