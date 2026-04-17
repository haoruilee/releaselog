import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { API_SCHEMA_VERSION } from "@/lib/api-constants";
import { entitySummary } from "@/lib/releases-query";
import { getMergedEntities } from "@/lib/releases-store";

export async function GET() {
  if (process.env.STATIC_EXPORT !== "1" && process.env.NEXT_PUBLIC_USE_SERVER_DATA !== "0") {
    noStore();
  }
  const entities = await getMergedEntities();
  return NextResponse.json({
    schemaVersion: API_SCHEMA_VERSION,
    entities: entities.map(entitySummary),
  });
}
