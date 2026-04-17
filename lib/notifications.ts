import { randomUUID } from "node:crypto";
import { getEntityById } from "@/data";
import { listActiveSubscribers, touchLastEmailedReleaseAt } from "@/lib/account-store";
import { ensureDb } from "@/lib/db";
import { getSubscriberFromEmail } from "@/lib/mail-from";
import { sendMail } from "@/lib/mailer";
import { getSiteUrl } from "@/lib/site-url";
import type { PublishedReleaseRecord } from "@/lib/releases-store";
import { isSubscriptionActive } from "@/lib/runtime-config";

function buildReleaseNotification(record: PublishedReleaseRecord): {
  subject: string;
  text: string;
  html: string;
} {
  const entity = getEntityById(record.entityId);
  const entityName = entity?.name ?? record.entityId;
  const link = record.item.sourceUrl ?? `${getSiteUrl()}/?entity=${encodeURIComponent(record.entityId)}#feed-${record.entityId}-${record.item.id}`;
  const headline = `${entityName}: ${record.item.title}`;
  const blurb = record.item.whatChanged ?? record.item.description ?? "";

  return {
    subject: `ReleaseLog Pro: ${headline}`,
    text: [headline, "", record.item.date, blurb, "", link].filter(Boolean).join("\n"),
    html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;max-width:560px">
      <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666">ReleaseLog Pro</p>
      <h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(headline)}</h1>
      <p style="color:#666;margin-top:0">${escapeHtml(record.item.date)}</p>
      ${blurb ? `<p>${escapeHtml(blurb)}</p>` : ""}
      <p><a href="${escapeHtml(link)}">Open source / detail</a></p>
      <p style="margin-top:24px;font-size:13px"><a href="${escapeHtml(`${getSiteUrl()}/subscribe`)}">Manage subscription</a></p>
    </body></html>`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendReleaseNotifications(record: PublishedReleaseRecord): Promise<{ attempted: number; sent: number; failed: number }> {
  const sql = await ensureDb();
  if (!sql) {
    return { attempted: 0, sent: 0, failed: 0 };
  }
  const from = getSubscriberFromEmail();
  if (!from) {
    return { attempted: 0, sent: 0, failed: 0 };
  }

  const subscribers = await listActiveSubscribers();
  const recipients = subscribers.filter(({ subscription, preferences }) => {
    if (!isSubscriptionActive(subscription.status)) return false;
    if (!preferences.emailEnabled) return false;
    return preferences.selectedEntityIds.includes(record.entityId);
  });

  const email = buildReleaseNotification(record);
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const existing = await sql<Array<{ id: string }>>`
      select id
      from sent_notifications
      where user_id = ${recipient.user.id}
        and release_id = ${record.id}
        and channel = ${"email"}
      limit 1
    `;
    if (existing[0]) {
      continue;
    }

    try {
      const result = await sendMail({
        from,
        to: recipient.user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      await sql`
        insert into sent_notifications (id, user_id, release_id, channel, status, provider_message_id)
        values (${randomUUID()}, ${recipient.user.id}, ${record.id}, ${"email"}, ${"sent"}, ${result.messageId ?? null})
      `;
      await touchLastEmailedReleaseAt(recipient.user.id);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await sql`
        insert into sent_notifications (id, user_id, release_id, channel, status, error)
        values (${randomUUID()}, ${recipient.user.id}, ${record.id}, ${"email"}, ${"failed"}, ${message})
        on conflict (user_id, release_id, channel) do nothing
      `;
      failed += 1;
    }
  }

  return {
    attempted: recipients.length,
    sent,
    failed,
  };
}
