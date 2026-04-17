import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/billing";

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const plan = (body as { plan?: unknown })?.plan;
  if (plan !== "monthly" && plan !== "yearly") {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  try {
    const url = await createCheckoutSession({
      userId: current.user.id,
      plan,
    });
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
