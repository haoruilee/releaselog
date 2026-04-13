import { NextResponse } from "next/server";
import { Resend } from "resend";
import { entities } from "@/data";
import { buildWeeklyDigestForEntities } from "@/lib/email-digest";
import { listSubscribeLeads } from "@/lib/subscribe-redis";

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
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return NextResponse.json({
      skipped: true,
      reason: "resend_or_from_not_configured",
    });
  }

  const leads = await listSubscribeLeads();
  if (leads.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_leads" });
  }

  const byEmail = new Map<string, Set<string>>();
  for (const lead of leads) {
    let set = byEmail.get(lead.email);
    if (!set) {
      set = new Set();
      byEmail.set(lead.email, set);
    }
    for (const id of lead.entityIds) {
      set.add(id);
    }
  }

  const resend = new Resend(apiKey);
  let sent = 0;
  const errors: string[] = [];

  for (const [email, idSet] of byEmail) {
    const { subject, text, html } = buildWeeklyDigestForEntities(entities, [...idSet], 7);
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject,
      text,
      html,
    });
    if (error) {
      errors.push(`${email}: ${error.message}`);
    } else {
      sent += 1;
    }
  }

  return NextResponse.json({ ok: true, sent, recipients: byEmail.size, errors });
}
