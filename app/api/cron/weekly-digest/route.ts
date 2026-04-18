import { NextResponse } from "next/server";
import { listActiveSubscribers } from "@/lib/account-store";
import { ensureDb } from "@/lib/db";
import { buildWeeklyDigestForEntities } from "@/lib/email-digest";
import { getSubscriberFromEmail } from "@/lib/mail-from";
import { sendMail } from "@/lib/mailer";
import { getMergedEntities } from "@/lib/releases-store";
import { isSubscriptionActive } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function computePeriodStartUTC(now = new Date()): string {
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday),
  );
  return monday.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  if (process.env.STATIC_EXPORT === "1") {
    return NextResponse.json(
      {
        error: "not_available",
        hint: "Cron digest runs on a server (e.g. Vercel), not on static GitHub Pages.",
      },
      { status: 503 },
    );
  }

  if (!verifyCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sql = await ensureDb();
  if (!sql) {
    return NextResponse.json({ skipped: true, reason: "db_unconfigured" });
  }

  const from = getSubscriberFromEmail();
  if (!from) {
    return NextResponse.json({
      skipped: true,
      reason: "mail_or_from_not_configured",
    });
  }

  const periodStart = computePeriodStartUTC();

  const subscribers = await listActiveSubscribers();
  const recipients = subscribers.filter(({ subscription, preferences }) =>
    isSubscriptionActive(subscription.status)
    && preferences.emailEnabled
    && preferences.selectedEntityIds.length > 0
  );
  if (recipients.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      skipped: 0,
      recipients: 0,
      periodStart,
      reason: "no_active_subscribers",
      errors: [],
    });
  }

  const entities = await getMergedEntities();
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    // Reserve the slot first — if it already exists for this user/week, skip.
    const reserved = await sql<Array<{ user_id: string }>>`
      insert into sent_digests (user_id, period_start, channel)
      values (${recipient.user.id}, ${periodStart}, ${"email"})
      on conflict do nothing
      returning user_id
    `;
    if (reserved.length === 0) {
      skipped += 1;
      continue;
    }

    const { subject, text, html } = buildWeeklyDigestForEntities(
      entities,
      recipient.preferences.selectedEntityIds,
      7,
    );
    try {
      const result = await sendMail({
        from,
        to: recipient.user.email,
        subject,
        text,
        html,
      });
      await sql`
        update sent_digests
        set provider_message_id = ${result.messageId ?? null}
        where user_id = ${recipient.user.id}
          and period_start = ${periodStart}
          and channel = ${"email"}
      `;
      sent += 1;
    } catch (error) {
      // Release the reservation so a manual retrigger can retry this user.
      await sql`
        delete from sent_digests
        where user_id = ${recipient.user.id}
          and period_start = ${periodStart}
          and channel = ${"email"}
      `;
      errors.push(
        `${recipient.user.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    recipients: recipients.length,
    periodStart,
    errors,
  });
}
