import { NextResponse } from "next/server";
import { entityMetas } from "@/data";
import { getCurrentUser } from "@/lib/auth";
import { updateNotificationPreferences } from "@/lib/account-store";

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

  const allowed = new Set(entityMetas.map((entity) => entity.id));
  const rawIds = Array.isArray((body as { entityIds?: unknown })?.entityIds)
    ? ((body as { entityIds: unknown[] }).entityIds)
    : [];
  const entityIds = [...new Set(rawIds.filter((id): id is string => typeof id === "string"))].filter((id) =>
    allowed.has(id),
  );

  if (entityIds.length === 0) {
    return NextResponse.json({ error: "entity_ids_required" }, { status: 400 });
  }

  const emailEnabled = Boolean((body as { emailEnabled?: unknown })?.emailEnabled);
  const rssEnabled = Boolean((body as { rssEnabled?: unknown })?.rssEnabled);

  const preferences = await updateNotificationPreferences({
    userId: current.user.id,
    selectedEntityIds: entityIds,
    emailEnabled,
    rssEnabled,
  });

  return NextResponse.json({ ok: true, preferences });
}
