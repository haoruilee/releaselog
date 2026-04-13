import { NextResponse } from "next/server";
import { entities, getEntityById } from "@/data";
import { API_SCHEMA_VERSION } from "@/lib/api-constants";
import { filterReleases, parseReleaseQuery } from "@/lib/releases-query";

export const dynamic = "force-static";

export function generateStaticParams() {
  return entities.map((e) => ({ id: e.id }));
}

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Params) {
  const { id } = await context.params;
  const entity = getEntityById(id);
  if (!entity) {
    return NextResponse.json({ error: "entity_not_found", id }, { status: 404 });
  }

  const staticExport = process.env.STATIC_EXPORT === "1";
  const searchParams = staticExport
    ? new URLSearchParams()
    : new URL(request.url).searchParams;
  const q = parseReleaseQuery(searchParams);
  const releases = filterReleases(entity.releases, q);

  return NextResponse.json({
    schemaVersion: API_SCHEMA_VERSION,
    entityId: entity.id,
    query: q,
    releases,
  });
}
