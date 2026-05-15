import { NextResponse } from "next/server";
import { recordAiHarnessEvent, recordAiHarnessRun } from "@/lib/ai-harness-store";

export const dynamic = "force-dynamic";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    if (body?.type === "event" || body?.phase) {
      const result = await recordAiHarnessEvent(body);
      return NextResponse.json({ ok: true, type: "event", ...result });
    }
    const result = await recordAiHarnessRun(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
