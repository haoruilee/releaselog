import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { entityMetas } from "@/data";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  const entityRoutes: MetadataRoute.Sitemap = entityMetas.map((e) => ({
    url: `${base}/${e.id}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...entityRoutes,
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/subscribe`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
