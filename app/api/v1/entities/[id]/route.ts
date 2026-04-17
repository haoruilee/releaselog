import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { entities } from "@/data";
import { API_SCHEMA_VERSION } from "@/lib/api-constants";
import { getMergedEntityById } from "@/lib/releases-store";

export function generateStaticParams() {
  return entities.map((e) => ({ id: e.id }));
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  if (process.env.STATIC_EXPORT !== "1" && process.env.NEXT_PUBLIC_USE_SERVER_DATA !== "0") {
    noStore();
  }
  const { id } = await context.params;
  const entity = await getMergedEntityById(id);
  if (!entity) {
    return NextResponse.json({ error: "entity_not_found", id }, { status: 404 });
  }
  return NextResponse.json({
    schemaVersion: API_SCHEMA_VERSION,
    entity,
  });
}
