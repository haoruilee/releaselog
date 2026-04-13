import type { EntityConfig, ReleaseItem } from "@/data/types";
import { format, subDays } from "date-fns";
import { getSiteUrl } from "@/lib/site-url";

function windowLastDays(days: number): { from: string; to: string } {
  const end = new Date();
  const start = subDays(end, Math.max(0, days - 1));
  return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd") };
}

export function releasesInWindow(
  releases: ReleaseItem[],
  from: string,
  to: string,
): ReleaseItem[] {
  return releases
    .filter((r) => r.date >= from && r.date <= to)
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.importance ?? 1) - (a.importance ?? 1);
    });
}

export function buildWeeklyDigestForEntities(
  entities: EntityConfig[],
  entityIds: string[],
  days = 7,
): { subject: string; text: string; html: string; releaseCount: number } {
  const { from, to } = windowLastDays(days);
  const base = getSiteUrl();
  const idSet = new Set(entityIds);
  const selected = entities.filter((e) => idSet.has(e.id));

  const sections: string[] = [];
  let releaseCount = 0;

  for (const e of selected) {
    const items = releasesInWindow(e.releases, from, to);
    if (items.length === 0) continue;
    releaseCount += items.length;
    const lines = items.map((r) => {
      const blurb = r.whatChanged ?? r.description ?? "";
      const link = r.sourceUrl ?? `${base}/?entity=${encodeURIComponent(e.id)}`;
      return `• ${r.date} — ${r.title}${blurb ? `\n  ${blurb}` : ""}\n  ${link}`;
    });
    sections.push(`${e.name}\n${lines.join("\n\n")}`);
  }

  const text =
    releaseCount === 0
      ? `No new releases in the last ${days} days for your selected feeds (${from} → ${to}).\n\nBrowse the calendar: ${base}/`
      : [
          `ReleaseLog — last ${days} days (${from} → ${to})`,
          "",
          ...sections,
          "",
          `Open site: ${base}/`,
          `Manage / RSS: ${base}/subscribe`,
        ].join("\n");

  const htmlSections =
    releaseCount === 0
      ? `<p>No new releases in the last ${days} days for your selected feeds.</p><p><a href="${base}/">Open ReleaseLog</a></p>`
      : selected
          .map((e) => {
            const items = releasesInWindow(e.releases, from, to);
            if (items.length === 0) return "";
            const lis = items
              .map((r) => {
                const blurb = r.whatChanged ?? r.description ?? "";
                const link = r.sourceUrl ?? `${base}/?entity=${encodeURIComponent(e.id)}`;
                return `<li style="margin-bottom:12px"><strong>${r.date}</strong> — ${escapeHtml(r.title)}${blurb ? `<br/><span style="color:#444">${escapeHtml(blurb)}</span>` : ""}<br/><a href="${escapeHtml(link)}">Link</a></li>`;
              })
              .join("");
            return `<h2 style="font-size:16px;margin-top:20px">${escapeHtml(e.name)}</h2><ul style="padding-left:18px">${lis}</ul>`;
          })
          .filter(Boolean)
          .join("");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5">
<h1 style="font-size:18px">ReleaseLog digest</h1>
<p style="color:#666">${from} → ${to}</p>
${htmlSections}
<p style="margin-top:24px;font-size:13px"><a href="${base}/subscribe">Feeds &amp; subscribe</a></p>
</body></html>`;

  const subject =
    releaseCount === 0
      ? `ReleaseLog: no releases this week (${from})`
      : `ReleaseLog: ${releaseCount} release${releaseCount === 1 ? "" : "s"} (${from} → ${to})`;

  return { subject, text, html, releaseCount };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
