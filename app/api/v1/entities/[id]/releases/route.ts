import { NextResponse } from "next/server";
import { getEntityById } from "@/data";
import { API_SCHEMA_VERSION } from "@/lib/api-constants";
import { filterReleases, parseReleaseQuery } from "@/lib/releases-query";

export const dynamic = "force-static";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Params) {
  const { id } = await context.params;
  const entity = getEntityById(id);
  if (!entity) {
    return NextResponse.json({ error: "entity_not_found", id }, { status: 404 });
  }

  const url = new URL(request.url);
  const q = parseReleaseQuery(url.searchParams);
  const releases = filterReleases(entity.releases, q);

  return NextResponse.json({
    schemaVersion: API_SCHEMA_VERSION,
    entityId: entity.id,
    query: q,
    releases,
  });
}
