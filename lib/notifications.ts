import { getEntityById } from "@/data";
import type { UserRecord } from "@/lib/account-store";
import type { PublishedReleaseRecord } from "@/lib/releases-store";
import { buildUnsubscribeToken } from "@/lib/security";
import { getSiteUrl } from "@/lib/site-url";

export type ReleaseEmailContent = {
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
};

export function buildReleaseNotification(
  record: PublishedReleaseRecord,
  recipient: { user: UserRecord },
): ReleaseEmailContent {
  const entity = getEntityById(record.entityId);
  const entityName = entity?.name ?? record.entityId;
  const base = getSiteUrl();
  const link = record.item.sourceUrl ?? `${base}/?entity=${encodeURIComponent(record.entityId)}#feed-${record.entityId}-${record.item.id}`;
  const headline = `${entityName}: ${record.item.title}`;
  const blurb = record.item.whatChanged ?? record.item.description ?? "";

  const unsubscribeUrl = `${base}/api/unsubscribe?token=${buildUnsubscribeToken(recipient.user.id, record.entityId)}`;
  const unsubscribeAllUrl = `${base}/api/unsubscribe?token=${buildUnsubscribeToken(recipient.user.id, "all")}`;

  const textLines = [headline, "", record.item.date];
  if (blurb) textLines.push(blurb);
  textLines.push("", link, "", `Unsubscribe from ${entityName}: ${unsubscribeUrl}`, `Unsubscribe from all: ${unsubscribeAllUrl}`);
  const text = textLines.filter((line) => line !== undefined).join("\n");

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;max-width:560px">
      <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666">ReleaseLog Pro</p>
      <h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(headline)}</h1>
      <p style="color:#666;margin-top:0">${escapeHtml(record.item.date)}</p>
      ${blurb ? `<p>${escapeHtml(blurb)}</p>` : ""}
      <p><a href="${escapeHtml(link)}">Open source / detail</a></p>
      <p style="margin-top:24px;font-size:13px;color:#666">Manage preferences: <a href="${escapeHtml(`${base}/subscribe`)}">${escapeHtml(`${base}/subscribe`)}</a></p>
      <p style="margin-top:8px;font-size:12px;color:#888">Stop emails about ${escapeHtml(entityName)}: <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a> &nbsp;·&nbsp; Stop all emails: <a href="${escapeHtml(unsubscribeAllUrl)}">Unsubscribe from all</a></p>
    </body></html>`;

  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  return {
    subject: `ReleaseLog Pro: ${headline}`,
    text,
    html,
    headers,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
