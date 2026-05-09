import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { entityMetas } from "@/data";
import { RESET_AGENT_SLUGS, RESET_EVENTS } from "@/data/reset-log";

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

  // One entry per reset event — each has its own static detail page at
  // /reset-log/{slug}. Adding a new event auto-extends the sitemap.
  const resetEventRoutes: MetadataRoute.Sitemap = RESET_EVENTS.map((e) => ({
    url: `${base}/reset-log/${e.slug}`,
    lastModified: new Date(e.effectiveDate ?? e.date),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const resetAgentRoutes: MetadataRoute.Sitemap = RESET_AGENT_SLUGS.map((agent) => ({
    url: `${base}/reset-log/${agent}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...entityRoutes,
    { url: `${base}/reset-log`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...resetAgentRoutes,
    ...resetEventRoutes,
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/subscribe`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
