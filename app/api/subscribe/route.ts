import { NextResponse } from "next/server";
import { entities } from "@/data";
import { appendSubscribeLead } from "@/lib/subscribe-redis";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = typeof (body as { email?: unknown }).email === "string"
    ? (body as { email: string }).email.trim().toLowerCase()
    : "";
  const rawIds = (body as { entityIds?: unknown }).entityIds;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json({ error: "entity_ids_required" }, { status: 400 });
  }

  const allowed = new Set(entities.map((e) => e.id));
  const entityIds = [...new Set(rawIds.filter((id): id is string => typeof id === "string"))].filter(
    (id) => allowed.has(id),
  );

  if (entityIds.length === 0) {
    return NextResponse.json({ error: "no_valid_entity_ids" }, { status: 400 });
  }

  try {
    await appendSubscribeLead({
      email,
      entityIds,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "redis_unconfigured") {
      return NextResponse.json(
        { error: "email_not_configured", hint: "Set Upstash Redis env vars to enable email signup." },
        { status: 503 },
      );
    }
    console.error("subscribe:", e);
    return NextResponse.json({ error: "store_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, entityIds });
}
