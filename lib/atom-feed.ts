import type { EntityConfig, ReleaseItem } from "@/data/types";
import { getSiteUrl } from "@/lib/site-url";

export type FeedEntry = {
  entityId: string;
  entityName: string;
  item: ReleaseItem;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatEntrySummary(item: ReleaseItem, entityName: string): string {
  const blocks: string[] = [];
  if (item.whatChanged) blocks.push(item.whatChanged);
  if (item.description) blocks.push(item.description);
  if (item.sourceUrl) blocks.push(`Link: ${item.sourceUrl}`);
  if (item.howTo?.steps?.length) {
    blocks.push(
      "How to:\n" + item.howTo.steps.map((step, i) => `${i + 1}. ${step}`).join("\n"),
    );
  }
  if (item.docUrls?.length) {
    blocks.push("More docs:\n" + item.docUrls.join("\n"));
  }
  blocks.push(`— ${entityName}`);
  return blocks.join("\n\n");
}

function atomUpdated(entries: FeedEntry[]): string {
  if (entries.length === 0) {
    return new Date().toISOString();
  }
  const latest = entries.reduce((max, e) => (e.item.date > max ? e.item.date : max), entries[0]!.item.date);
  return new Date(latest + "T12:00:00Z").toISOString();
}

function sortEntriesNewestFirst(entries: FeedEntry[]): FeedEntry[] {
  return [...entries].sort((a, b) => {
    if (a.item.date !== b.item.date) return b.item.date.localeCompare(a.item.date);
    const ia = a.item.importance ?? 1;
    const ib = b.item.importance ?? 1;
    if (ib !== ia) return ib - ia;
    return a.item.title.localeCompare(b.item.title);
  });
}

export function collectAllFeedEntries(entities: EntityConfig[], maxEntries = 200): FeedEntry[] {
  const out: FeedEntry[] = [];
  for (const e of entities) {
    for (const item of e.releases) {
      out.push({ entityId: e.id, entityName: e.name, item });
    }
  }
  return sortEntriesNewestFirst(out).slice(0, maxEntries);
}

export function buildAtomFeed(options: {
  title: string;
  subtitle?: string;
  feedPath: string;
  entries: FeedEntry[];
}): string {
  const base = getSiteUrl();
  const selfUrl = `${base}${options.feedPath}`;
  const updated = atomUpdated(options.entries);
  const entriesXml = sortEntriesNewestFirst(options.entries)
    .map((e) => {
      const { item } = e;
      const entryUrl = `${base}/?entity=${encodeURIComponent(e.entityId)}#feed-${e.entityId}-${item.id}`;
      const published = new Date(item.date + "T12:00:00Z").toISOString();
      const summary = formatEntrySummary(item, e.entityName);
      const title = item.shortTitle ? `${item.title} (${e.entityName})` : `${item.title} · ${e.entityName}`;
      return `
  <entry>
    <title>${escapeXml(title)}</title>
    <link href="${escapeXml(item.sourceUrl ?? entryUrl)}" rel="alternate" type="text/html"/>
    <id>${escapeXml(entryUrl)}</id>
    <updated>${published}</updated>
    <published>${published}</published>
    <summary type="text">${escapeXml(summary)}</summary>
  </entry>`;
    })
    .join("");

  const subtitleXml = options.subtitle
    ? `\n  <subtitle>${escapeXml(options.subtitle)}</subtitle>`
    : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(options.title)}</title>${subtitleXml}
  <link href="${escapeXml(selfUrl)}" rel="self" type="application/atom+xml"/>
  <link href="${escapeXml(base + "/")}" rel="alternate" type="text/html"/>
  <updated>${updated}</updated>
  <id>${escapeXml(selfUrl)}</id>
  <author><name>${escapeXml("ReleaseLog")}</name></author>
  <generator uri="${escapeXml(base)}" version="1.0">ReleaseLog</generator>
${entriesXml}
</feed>`;
}
