import { NextResponse } from "next/server";
import { entities } from "@/data";
import { API_SCHEMA_VERSION } from "@/lib/api-constants";
import { entitySummary } from "@/lib/releases-query";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    schemaVersion: API_SCHEMA_VERSION,
    entities: entities.map(entitySummary),
  });
}
