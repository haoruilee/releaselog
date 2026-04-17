import { NextResponse } from "next/server";
import { listActiveSubscribers } from "@/lib/account-store";
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

  const from = getSubscriberFromEmail();
  if (!from) {
    return NextResponse.json({
      skipped: true,
      reason: "mail_or_from_not_configured",
    });
  }

  const subscribers = await listActiveSubscribers();
  const recipients = subscribers.filter(({ subscription, preferences }) =>
    isSubscriptionActive(subscription.status) && preferences.emailEnabled
  );
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_active_subscribers" });
  }

  const entities = await getMergedEntities();
  let sent = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    const { subject, text, html } = buildWeeklyDigestForEntities(
      entities,
      recipient.preferences.selectedEntityIds,
      7,
    );
    try {
      await sendMail({
        from,
        to: recipient.user.email,
        subject,
        text,
        html,
      });
      sent += 1;
    } catch (error) {
      errors.push(`${recipient.user.email}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return NextResponse.json({ ok: true, sent, recipients: recipients.length, errors });
}
