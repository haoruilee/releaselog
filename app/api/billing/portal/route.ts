import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCustomerPortalUrl } from "@/lib/billing";

export async function POST() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const url = await createCustomerPortalUrl(current.user.id);
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
