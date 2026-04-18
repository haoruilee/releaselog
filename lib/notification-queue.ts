import { randomUUID } from "node:crypto";
import { listActiveSubscribers, type UserRecord } from "@/lib/account-store";
import { ensureDb } from "@/lib/db";
import { getSubscriberFromEmail } from "@/lib/mail-from";
import { sendMail } from "@/lib/mailer";
import { buildReleaseNotification } from "@/lib/notifications";
import { getPublishedReleaseById, type PublishedReleaseRecord } from "@/lib/releases-store";
import { isSubscriptionActive } from "@/lib/runtime-config";

const MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 4;
const CLAIM_TIMEOUT_MINUTES = 5;

export async function enqueueReleaseNotifications(
  releaseId: string,
): Promise<{ enqueued: number }> {
  const sql = await ensureDb();
  if (!sql) return { enqueued: 0 };

  const release = await getPublishedReleaseById(releaseId);
  if (!release) return { enqueued: 0 };

  const subscribers = await listActiveSubscribers();
  const recipients = subscribers.filter(({ subscription, preferences }) => {
    if (!isSubscriptionActive(subscription.status)) return false;
    if (!preferences.emailEnabled) return false;
    return preferences.selectedEntityIds.includes(release.entityId);
  });

  let enqueued = 0;
  for (const recipient of recipients) {
    const inserted = await sql<Array<{ id: string }>>`
      insert into sent_notifications (id, user_id, release_id, channel, status, attempts, next_retry_at, updated_at)
      values (${randomUUID()}, ${recipient.user.id}, ${releaseId}, ${"email"}, ${"pending"}, 0, now(), now())
      on conflict (user_id, release_id, channel) do nothing
      returning id
    `;
    if (inserted.length > 0) enqueued += 1;
  }

  return { enqueued };
}

type ClaimedRow = {
  id: string;
  user_id: string;
  release_id: string;
  attempts: number;
};

export async function runSendWorker(
  opts: { batchSize?: number; concurrency?: number } = {},
): Promise<{ claimed: number; sent: number; failed: number; permanentlyFailed: number }> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const concurrency = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);

  const maybeSql = await ensureDb();
  if (!maybeSql) return { claimed: 0, sent: 0, failed: 0, permanentlyFailed: 0 };
  const sql = maybeSql;

  const from = getSubscriberFromEmail();
  if (!from) return { claimed: 0, sent: 0, failed: 0, permanentlyFailed: 0 };

  // Short-tx claim: flip pending|failed -> sending, push next_retry_at out
  // so crashed/stuck rows become eligible again after the safety window.
  const claimed = await sql<ClaimedRow[]>`
    with picked as (
      select id from sent_notifications
      where status in ('pending','failed')
        and next_retry_at <= now()
        and attempts < ${MAX_ATTEMPTS}
      order by next_retry_at asc
      limit ${batchSize}
      for update skip locked
    )
    update sent_notifications n
    set status = 'sending',
        updated_at = now(),
        next_retry_at = now() + make_interval(mins => ${CLAIM_TIMEOUT_MINUTES})
    from picked
    where n.id = picked.id
    returning n.id, n.user_id, n.release_id, n.attempts
  `;

  if (claimed.length === 0) {
    return { claimed: 0, sent: 0, failed: 0, permanentlyFailed: 0 };
  }

  // Resolve releases and users once per batch.
  const releaseIds = Array.from(new Set(claimed.map((r) => r.release_id)));
  const userIds = Array.from(new Set(claimed.map((r) => r.user_id)));

  const releases = new Map<string, PublishedReleaseRecord>();
  for (const rid of releaseIds) {
    const rec = await getPublishedReleaseById(rid);
    if (rec) releases.set(rid, rec);
  }

  const userRows = await sql<Array<{ id: string; email: string; stripe_customer_id: string | null; created_at: Date; last_login_at: Date | null }>>`
    select id, email, stripe_customer_id, created_at, last_login_at
    from users
    where id in ${sql(userIds)}
  `;
  const users = new Map<string, UserRecord>();
  for (const u of userRows) {
    users.set(u.id, {
      id: u.id,
      email: u.email,
      stripeCustomerId: u.stripe_customer_id,
      createdAt: u.created_at.toISOString(),
      lastLoginAt: u.last_login_at?.toISOString() ?? null,
    });
  }

  let sent = 0;
  let failed = 0;
  let permanentlyFailed = 0;

  async function processOne(row: ClaimedRow): Promise<void> {
    const release = releases.get(row.release_id);
    const user = users.get(row.user_id);
    if (!release || !user) {
      // Orphan row (release or user deleted). Mark permanently failed so it stops being picked up.
      await sql`
        update sent_notifications
        set status = 'failed',
            error = ${"orphan_row"},
            attempts = ${MAX_ATTEMPTS},
            next_retry_at = now(),
            updated_at = now()
        where id = ${row.id}
      `;
      permanentlyFailed += 1;
      failed += 1;
      return;
    }

    const email = buildReleaseNotification(release, { user });
    try {
      const result = await sendMail({
        from: from!,
        to: user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: email.headers,
      });
      await sql`
        update sent_notifications
        set status = 'sent',
            provider_message_id = ${result.messageId ?? null},
            error = null,
            updated_at = now()
        where id = ${row.id}
      `;
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextAttempts = row.attempts + 1;
      const reachedCap = nextAttempts >= MAX_ATTEMPTS;
      // Exponential backoff on the OLD attempts value: 1, 2, 4, 8, 16 minutes.
      await sql`
        update sent_notifications
        set status = 'failed',
            error = ${message},
            attempts = ${nextAttempts},
            next_retry_at = now() + make_interval(mins => power(2, ${row.attempts})::int),
            updated_at = now()
        where id = ${row.id}
      `;
      failed += 1;
      if (reachedCap) permanentlyFailed += 1;
    }
  }

  // Concurrency-bounded processing.
  for (let i = 0; i < claimed.length; i += concurrency) {
    const chunk = claimed.slice(i, i + concurrency);
    await Promise.allSettled(chunk.map((row) => processOne(row)));
  }

  return { claimed: claimed.length, sent, failed, permanentlyFailed };
}
