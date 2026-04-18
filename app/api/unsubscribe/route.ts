import { NextResponse } from "next/server";
import { ensureNotificationPreferences, updateNotificationPreferences } from "@/lib/account-store";
import { parseUnsubscribeToken } from "@/lib/security";

export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<NextResponse> {
  if (process.env.STATIC_EXPORT === "1") {
    return NextResponse.json(
      {
        error: "not_available",
        hint: "Unsubscribe runs on a server (e.g. Vercel), not on static GitHub Pages.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const parsed = parseUnsubscribeToken(token);
  if (!parsed) {
    return new NextResponse("Invalid or expired unsubscribe link.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const prefs = await ensureNotificationPreferences(parsed.userId);

  let emailEnabled = prefs.emailEnabled;
  let selectedEntityIds = prefs.selectedEntityIds;

  if (parsed.target === "all") {
    emailEnabled = false;
  } else {
    selectedEntityIds = selectedEntityIds.filter((id) => id !== parsed.target);
  }

  await updateNotificationPreferences({
    userId: parsed.userId,
    emailEnabled,
    rssEnabled: prefs.rssEnabled,
    selectedEntityIds,
  });

  const body =
    parsed.target === "all"
      ? "You have been unsubscribed from all ReleaseLog emails."
      : `You have been unsubscribed from updates for ${parsed.target}.`;

  return new NextResponse(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
