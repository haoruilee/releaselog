import { NextResponse } from "next/server";
import { getEntityById } from "@/data";
import { API_SCHEMA_VERSION } from "@/lib/api-constants";

export const dynamic = "force-static";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  const entity = getEntityById(id);
  if (!entity) {
    return NextResponse.json({ error: "entity_not_found", id }, { status: 404 });
  }
  return NextResponse.json({
    schemaVersion: API_SCHEMA_VERSION,
    entity,
  });
}
