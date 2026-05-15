import { NextResponse } from "next/server";
import { applyAiReviewDecisions, listAiReviewCandidates } from "@/lib/ai-review";

export const dynamic = "force-dynamic";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "12", 10);
  const candidates = await listAiReviewCandidates(Number.isFinite(limit) ? limit : 12);
  return NextResponse.json({ ok: true, candidates });
}

export async function POST(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const result = await applyAiReviewDecisions(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
