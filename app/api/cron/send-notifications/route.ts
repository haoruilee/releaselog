import { NextResponse } from "next/server";
import { runSendWorker } from "@/lib/notification-queue";

export const dynamic = "force-dynamic";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: Request): Promise<NextResponse> {
  if (process.env.STATIC_EXPORT === "1") {
    return NextResponse.json(
      {
        error: "not_available",
        hint: "Send worker runs on a server (e.g. Vercel), not on static GitHub Pages.",
      },
      { status: 503 },
    );
  }

  if (!verifyCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSendWorker();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
