import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rotatePrivateFeedToken } from "@/lib/account-store";
import { getSiteUrl } from "@/lib/site-url";

export async function POST() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawToken = await rotatePrivateFeedToken(current.user.id);
  return NextResponse.json({
    ok: true,
    feedUrl: `${getSiteUrl()}/feeds/private/${rawToken}.xml`,
  });
}
